import Conversations from "../schemas/ConversationModel.js";
import Messages from "../schemas/MessageModel.js";

// Function to mark the last read message in a conversation
const markReadMessage = async (userId, loggedUser) => {
  try {
    const existing_conversations = await Conversations.findOne({
      participants: {
        $size: 2,
        $all: [userId, loggedUser],
      },
    });

    let conversationId = existing_conversations?._id;

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
    const updatedConversation = await Conversations.findOneAndUpdate(
      { _id: conversationId },
      { $set: { lastReadMessage: latestMessage._id } },
      { new: true, useFindAndModify: false }
    );
    return updatedConversation;
  } catch (error) {
    console.error("Error in markReadMessage:", error.message);
  }
};

export { markReadMessage };
