import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Please provide a username"],
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Please provide a email"],
      unique: true,
    },
    password: { type: String, required: [true, "Please provide a password"] },
    resetPasswordOTP: { type: Number, required: false },
    resetPasswordExpires: { type: Date, required: false },
    isVerified: { type: Boolean, default: false },
    fullName: { type: String, required: true },
    bio: { type: String },
    avatar: {
      type: String,
      default:
        "https://res.cloudinary.com/deyq54d8b/image/upload/v1707136917/Social-Media-App/default-profile.jpg",
    }, // URL to user's profile picture
    banner: {
      type: String,
      default:
        "https://res.cloudinary.com/deyq54d8b/image/upload/v1707136917/Social-Media-App/default-banner.jpg",
    }, // URL to user's banner picture
    isPrivate: { type: Boolean, default: false },
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "posts" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    followRequest: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    lastLoginAt: { type: Date, require: true, default: new Date() },
    socket_id: {
      type: String,
    },
    status: { type: Boolean, default: false },
    lastOnline: { type: Date, require: true, default: new Date() },
  },
  {
    timestamps: true,
  }
);

const Users = mongoose.models.users || mongoose.model("users", userSchema);

export default Users;
