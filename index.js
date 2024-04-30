import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import { Server } from "socket.io";
import { createServer } from "http";
import Users from "./schemas/UserModel.js";
import Conversations from "./schemas/ConversationModel.js";
import Messages from "./schemas/MessageModel.js";
import { getUnreadMessageCount } from "./utils/conversations.js";
import { markReadMessage } from "./utils/messages.js";
// import sharp from "sharp";
import cloudinary from "./cloudnary/cloudConfig.js";
dotenv.config();

const PORT = process.env.PORT || 3001;
const app = express();
const httpServer = createServer(app); // Create HTTP server

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_SIDE_URL,
    methods: ["GET", "POST"],
    // credentials: true,
  },
});

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then((db) => {
    // console.log("Connected to the database");
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error.message);
  });

const uploadFiles = async (files) => {
  const uploadedFiles = Object.values(files);

  const cloudinaryPromises = uploadedFiles.map(async (file) => {
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);

    // Compressing and resizing with Sharp
    // const compressedImage = await sharp(buffer)
    //   .resize(1024, 1024, { fit: "inside" }) // Resizes while keeping aspect ratio
    //   .jpeg({ quality: 80 }) // Adjust quality (JPEG compression)
    //   .toBuffer(); // Output as buffer

    // const base64Data = compressedImage.toString("base64");
    const base64Data = buffer.toString("base64");
    const finalData = `data:image/jpg;base64,${base64Data}`;

    const uploadMethod =
      buffer.length > 10 * 1024 * 1024 ? "upload_large" : "upload";

    let options = {
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      folder: "Instello/Chat",
      resource_type: "auto",
    };

    try {
      const uploadResult = await cloudinary.uploader[uploadMethod](
        finalData,
        options
      );
      console.log("Uploaded successfully:");
      return uploadResult;
    } catch (error) {
      console.error("Error during upload:", error);
    }
  });

  const cloudinaryResponses = await Promise.all(cloudinaryPromises);
  return cloudinaryResponses.map((response) => response.secure_url);
};

let users_array = [];

io.on("connection", async (socket) => {
  const user_id = socket.handshake.query["user_id"];

  if (user_id != null && Boolean(user_id)) {
    try {
      const isUserAlreadyConnected = users_array.find(
        (user) => user.user_id === user_id
      );

      if (!isUserAlreadyConnected) {
        await Users.findByIdAndUpdate(user_id, {
          socket_id: socket.id,
          status: true,
        });
        const user = {
          user_id,
          socket_id: socket.id,
        };
        users_array.push(user);
        socket.broadcast.emit("userOnline", { userId: user_id });
        console.log("pushing user", user);

        io.emit("getUsers", users_array);
      }
    } catch (e) {
      console.log(e);
    }
  }

  socket.on("follow_request", async ({ type, senderId, receiverId }) => {
    const sender = users_array.find((e) => e.user_id === senderId);
    const receiver = users_array.find((e) => e.user_id === receiverId);

    if (type === "follow") {
      const userData = await Users.findOne({ _id: sender?.user_id }).select(
        "username avatar"
      );

      io.to(receiver?.socket_id).emit("new_friend_request", {
        message: `${userData?.username} started following you`,
        username: userData?.username,
        avatar: userData?.avatar,
      });
    }
  });

  socket?.on("typing", async ({ senderId, receiverId }) => {
    const receiver = users_array.find((e) => e.user_id === receiverId);
    socket.to(receiver?.socket_id).emit("user_typing", {
      message: "typing message...",
      senderId,
    });
  });

  socket?.on("stop_typing", async ({ senderId, receiverId }) => {
    const receiver = users_array.find((e) => e.user_id === receiverId);
    socket.to(receiver?.socket_id).emit("user_stop_typing", {
      message: "typing message...",
      senderId,
    });
  });

  socket.on(
    "send_message",
    async ({
      senderId,
      receiverId,
      avatar,
      username,
      type = "text",
      text,
      file = [],
      newKey,
      status,
    }) => {
      try {
        const existing_conversations = await Conversations.findOne({
          participants: {
            $size: 2,
            $all: [senderId, receiverId],
          },
        });

        let conversationId = existing_conversations?._id;

        if (!existing_conversations) {
          const participants = [senderId, receiverId];
          const newConversations = new Conversations({ participants });
          const conversation = await newConversations.save();
          conversationId = conversation._id;
        }

        const secure_url = await uploadFiles(file);

        const newMessage = new Messages({
          conversationId,
          senderId,
          receiverId,
          type,
          text,
          file: secure_url,
        });

        const saveMessage = await newMessage.save({
          new: true,
          validateModifiedOnly: true,
        });

        await Conversations.findByIdAndUpdate(conversationId, {
          $push: { messages: saveMessage._id },
          $set: {
            lastMessageCreatedAt: Date.now(),
            lastMessage: saveMessage._id,
          },
        });

        const sender = users_array.find((e) => e.user_id === senderId);
        const receiver = users_array.find((e) => e.user_id === receiverId);

        io.to(sender?.socket_id).emit("send_new_message", {
          _id: saveMessage?._id,
          newKey,
          conversationId,
          senderId,
          receiverId,
          type,
          text,
          avatar,
          username,
          file: secure_url,
          status: false,
        });

        const user = await Users.findById(senderId).select("username avatar");
        io.to(receiver?.socket_id).emit("receive_new_message", {
          _id: saveMessage._id,
          conversationId,
          newKey,
          senderId,
          receiverId,
          type,
          text,
          avatar: user.avatar,
          username: user.username,
          file: secure_url,
          status: false,
        });
      } catch (error) {
        console.log("send_message Error:", error);
      }
    }
  );

  socket?.on("read_messages", async ({ userId, loggedUser }, callback) => {
    const updatedConversation = await markReadMessage(userId, loggedUser);
    const user = users_array.find((e) => e.user_id === userId);
    io.to(user?.socket_id).emit("seen_message", updatedConversation)
    callback(updatedConversation);
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected", socket.id);
    const disconnectUser = users_array.find(
      (user) => user.socket_id === socket.id
    );
    users_array = users_array.filter((user) => user.socket_id !== socket.id);
    if (disconnectUser) {
      await Users.findByIdAndUpdate(disconnectUser.user_id, {
        status: false,
      });
      socket.broadcast.emit("userOffline", { userId: disconnectUser.user_id });
    }
    socket.disconnect();
  });

  socket.on("end", async (id) => {
    if (id) {
      await Users.findByIdAndUpdate(id, { status: false });
    }
    console.log("closing connection");
    socket.disconnect(0);
  });
});

app.get("/", (req, res) => {
  res.status(200).send("Hello World!");
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
