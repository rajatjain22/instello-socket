import mongoose from "mongoose";
import Conversations from "../schemas/ConversationModel.js";
import Messages from "../schemas/MessageModel.js";

// Function to mark the last read message in a conversation
const markReadMessage = async (conversationId, loggedUser) => {
  let retries = 3; // Number of retries if there's a transient error
  while (retries > 0) {
    try {
      const message = await Messages.findOne({
        conversationId,
      }).sort({ createdAt: -1 });

      // Check if the message sender is not the logged user
      if (message.senderId.toString() !== loggedUser) {
        const convo = await Conversations.findById(conversationId);

        if (!convo) {
          throw new Error("Conversation not found");
        }

        // Update the conversation's lastReadMessage field
        await Conversations.updateOne(
          { _id: conversationId },
          { $set: { lastReadMessage: convo.lastMessage } }
        );
        return; // Successful update
      }
    } catch (error) {
      if (error.code === 'ECONNRESET' && retries > 1) {
        console.log("Connection reset. Retrying...");
        retries -= 1; // Decrement the retries count
        continue; // Retry the operation
      } else {
        console.error("Error in markReadMessage:", error);
        return; // Stop retrying
      }
    }
  }
};

export { markReadMessage };
