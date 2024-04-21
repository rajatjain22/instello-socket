import mongoose from "mongoose";
import Messages from "../schemas/MessageModel.js";

const getUnreadMessageCount = async (conversationId, lastReadMessage) => {
  try {
    if (!lastReadMessage) {
      return await Messages.countDocuments({ conversationId });
    }

    const lastReadMessageObjId = new mongoose.Types.ObjectId(lastReadMessage);

    const result = await Messages.aggregate([
      {
        $match: {
          _id: lastReadMessageObjId,
        },
      },
      {
        $lookup: {
          from: "messages",
          let: { createdAt: "$createdAt" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$conversationId", conversationId] },
                    { $gt: ["$createdAt", "$$createdAt"] },
                  ],
                },
              },
            },
          ],
          as: "unreadMessages",
        },
      },
      {
        $project: {
          unreadMessageCount: { $size: "$unreadMessages" },
        },
      },
    ]);

    if (result.length > 0) {
      return result[0].unreadMessageCount || 0;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("Error in getUnreadMessageCount:", error);
    throw error;
  }
};

export { getUnreadMessageCount };
