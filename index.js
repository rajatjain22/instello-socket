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
        console.log("pushing user", user);

        io.emit("getUsers", users_array);
      }
    } catch (e) {
      console.log(e);
    }
  }

  // socket?.on("get_conversations", async ({ userId }, callback) => {
  //   console.log(userId);
  //   const existing_conversations = await Conversations.find({
  //     participants: { $in: [userId] },
  //   })
  //     .populate("participants", "username avatar status")
  //     .populate("lastMessage")
  //     .populate("lastReadMessage")
  //     .sort({ lastMessageCreatedAt: -1 })
  //     .exec();

  //   const list = await Promise.all(
  //     existing_conversations.map(async (el) => {
  //       const user = el.participants.find(
  //         (elm) => elm._id.toString() !== userId
  //       );

  //       return {
  //         id: el._id,
  //         user_id: user?._id,
  //         username: user?.username,
  //         avatar: user?.avatar,
  //         lastMessage: el?.lastMessage?.text,
  //         status: user?.status,
  //         lastMessageCreatedAt: el?.lastMessage?.createdAt ?? "",
  //         unreadCount:
  //           userId === el?.lastMessage?.senderId.toString()
  //             ? 0
  //             : await getUnreadMessageCount(
  //                 el._id,
  //                 el?.lastReadMessage?._id ?? null
  //               ),
  //       };
  //     })
  //   );

  //   callback(list);
  // });

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

  socket?.on("get_messages", async ({ conversationId }, callback) => {
    console.log("conversationId ===> ", conversationId);
    const allMessages = await Messages.find({ conversationId });
    callback(allMessages);
  });

  socket?.on(
    "read_messages",
    async ({ conversationId, loggedUser }, callback) => {
      markReadMessage(conversationId, loggedUser);
      callback("read");
    }
  );

  socket.on(
    "send_message",
    async ({
      conversationId,
      senderId,
      receiverId,
      avatar,
      username,
      type = "text",
      text,
      file = "",
    }) => {
      let newConversationId = conversationId;

      if (conversationId === "new") {
        const participants = [senderId, receiverId];
        const newConversations = new Conversations({ participants });
        const conversation = await newConversations.save();
        newConversationId = conversation?._id;
      }
      const newMessage = new Messages({
        conversationId: newConversationId,
        senderId,
        receiverId,
        type,
        text,
      });

      const saveMessage = await newMessage.save({
        new: true,
        validateModifiedOnly: true,
      });

      await Conversations.findByIdAndUpdate(newConversationId, {
        $push: { messages: saveMessage._id },
        $set: {
          lastMessageCreatedAt: Date.now(),
          lastMessage: saveMessage._id,
        },
      });

      const sender = users_array.find((e) => e.user_id === senderId);
      const receiver = users_array.find((e) => e.user_id === receiverId);
      console.log(sender);
      io.to(sender?.socket_id).emit("send_new_message", {
        _id: saveMessage._id,
        conversationId: newConversationId,
        senderId,
        receiverId,
        type,
        text,
        avatar,
        username,
        file,
      });

      io.to(receiver?.socket_id).emit("receive_new_message", {
        _id: saveMessage._id,
        conversationId: newConversationId,
        senderId,
        receiverId,
        type,
        text,
        avatar,
        username,
        file,
      });
    }
  );

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
    }
    socket.disconnect();
  });
});

app.get("/get_conversations/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(404).json({ message: "UserId not found" });
    }

    const existing_conversations = await Conversations.find({
      participants: { $in: [userId] },
    })
      .populate("participants", "username avatar status")
      .populate("lastMessage")
      .populate("lastReadMessage")
      .sort({ lastMessageCreatedAt: -1 })
      .exec();

    // const data = await Conversations.aggregate([
    //   {
    //     $match: {
    //       participants: { $in: [new mongoose.Types.ObjectId(userId)] },
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "users",
    //       localField: "participants",
    //       foreignField: "_id",
    //       as: "participants",
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "messages",
    //       localField: "lastMessage",
    //       foreignField: "_id",
    //       as: "lastMessage",
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: "messages",
    //       localField: "lastReadMessage",
    //       foreignField: "_id",
    //       as: "lastReadMessage",
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 1,
    //       participants: { _id: 1, username: 1, avatar: 1, status: 1 },
    //       lastMessageCreatedAt: 1,
    //       lastReadMessage: { $arrayElemAt: ["$lastReadMessage", 0] },
    //       lastMessage: { $arrayElemAt: ["$lastMessage", 0] },
    //     },
    //   },
    // ]);

    const list = await Promise.all(
      existing_conversations.map(async (el) => {
        const user = el.participants.find(
          (elm) => elm._id.toString() !== userId
        );

        return {
          id: el._id,
          user_id: user?._id,
          username: user?.username,
          avatar: user?.avatar,
          lastMessage: el?.lastMessage?.text,
          status: user?.status,
          lastMessageCreatedAt: el?.lastMessage?.createdAt ?? "",
          unreadCount:
            userId === el?.lastMessage?.senderId.toString()
              ? 0
              : await getUnreadMessageCount(
                  el._id,
                  el?.lastReadMessage?._id ?? null
                ),
        };
      })
    );

    res.json(list);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
