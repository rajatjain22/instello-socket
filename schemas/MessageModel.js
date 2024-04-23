import mongoose from "mongoose";

const messageSchema = mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "conversations",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "media", "document", "link"],
      required: true,
      default: "text",
    },
    text: {
      type: String,
    },
    file: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

const Messages =
  mongoose.models.messages || mongoose.model("messages", messageSchema);

export default Messages;
