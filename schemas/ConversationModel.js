import mongoose from "mongoose";

const conversationSchema = mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
      default: "private",
    },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "messages" }],
    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "messages",
      default: null,
    },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "messages" },
    lastMessageCreatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

const Conversations =
  mongoose.models.conversations ||
  mongoose.model("conversations", conversationSchema);

export default Conversations;
