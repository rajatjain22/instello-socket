import Conversations from "../schemas/ConversationModel.js";
import Messages from "../schemas/MessageModel.js";

// Function to mark the last read message in a conversation
const markReadMessage = async (conversationId, loggedUser) => {
  try {
    // Fetch the most recent message for the conversation
    const latestMessage = await Messages.findOne({ conversationId })
      .sort({ createdAt: -1 })
      .lean(); // Lean improves performance by returning plain JS objects

    if (!latestMessage) {
      console.warn("No messages found in the conversation");
      return;
    }

    // If the latest message was sent by the logged-in user, no need to update
    if (latestMessage.senderId.toString() === loggedUser) {
      return;
    }

    // Update the 'lastReadMessage' field in the conversation
    await Conversations.updateOne(
      { _id: conversationId },
      { $set: { lastReadMessage: latestMessage._id } }
    );
    return;
  } catch (error) {
    console.error("Error in markReadMessage:", error.message);
  }
};

export { markReadMessage };
