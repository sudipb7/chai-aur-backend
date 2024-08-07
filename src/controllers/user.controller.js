import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { COOKIE_OPTIONS, DAY, WEEK } from "../constants.js";

const generateTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const refreshToken = await user.generateRefreshToken();
    const accessToken = await user.generateAccessToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { refreshToken, accessToken };
  } catch (error) {
    throw new ApiError(500, "Failed to generate tokens");
  }
};

const register = asyncHandler(async (req, res) => {
  const { fullname, username, email, password } = req.body;

  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  const userExists = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExists) {
    throw new ApiError(409, "Username or email already exists");
  }

  const { avatar, coverImage } = req.files;

  if (!avatar || !Array.isArray(avatar) || !avatar[0] || !avatar[0]?.path) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatarRes = await uploadOnCloudinary(avatar[0].path);
  let coverImageRes;
  if (
    coverImage &&
    Array.isArray(coverImage) &&
    coverImage[0] &&
    coverImage[0]?.path
  ) {
    coverImageRes = await uploadOnCloudinary(coverImage[0].path);
  }

  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    avatar: avatarRes.secure_url,
    coverImage: coverImageRes?.secure_url || "",
  });

  if (!user) {
    throw new ApiError(500, "Failed to create user");
  }

  delete user._doc.password;
  delete user._doc.refreshToken; // Not compulsory as it is empty by default

  return res.status(201).json(
    new ApiResponse({
      statusCode: 201,
      data: { user: user._doc },
      message: "User created successfully",
    })
  );
});

const login = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid credentials");
  }

  delete user._doc.password;
  delete user._doc.refreshToken;

  const { accessToken, refreshToken } = await generateTokens(user._id);

  res
    .status(200)
    .cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: WEEK,
    })
    .cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: DAY,
    })
    .json(
      new ApiResponse({
        statusCode: 200,
        data: { user: user._doc, refreshToken, accessToken },
        message: "User logged in successfully",
      })
    );
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      // $set: { refreshToken: "" },
      $unset: {
        refreshToken: 1, // This removes the field from document
      },
    }
    // {
    //   new: true, // Returns the updated document
    // }
  );

  return res
    .status(200)
    .clearCookie("refreshToken", COOKIE_OPTIONS)
    .clearCookie("accessToken", COOKIE_OPTIONS)
    .json(
      new ApiResponse({
        statusCode: 200,
        message: "User logged out successfully",
      })
    );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized");
  }

  const decoded = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decoded?._id);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (user.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  const { accessToken, refreshToken } = await generateTokens(user._id);

  res
    .status(200)
    .cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: WEEK,
    })
    .cookie("accessToken", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: DAY,
    })
    .json(
      new ApiResponse({
        statusCode: 200,
        data: { refreshToken, accessToken },
        message: "Refreshed access token successfully",
      })
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid current password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      message: "Password changed successfully",
    })
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      data: { user: req.user },
      message: "User retrieved successfully",
    })
  );
});

const updateUser = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if ([fullname, email].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email: email.toLowerCase(),
      },
    },
    {
      new: true, // Returns the updated document
    }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(500, "Failed to update user");
  }

  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      data: { user },
      message: "User updated successfully",
    })
  );
});

const updateAvatar = asyncHandler(async (req, res) => {
  const path = req.file?.path;

  if (!path) {
    throw new ApiError(400, "Avatar is required");
  }

  const uploadResponse = await uploadOnCloudinary(path);

  if (!uploadResponse) {
    throw new ApiError(500, "Failed to update avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: uploadResponse.secure_url,
      },
    },
    {
      new: true, // Returns the updated document
    }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(500, "Failed to update avatar");
  }

  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      data: { user },
      message: "Avatar updated successfully",
    })
  );
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const path = req.file?.path;

  if (!path) {
    throw new ApiError(400, "Cover Image is required");
  }

  const uploadResponse = await uploadOnCloudinary(path);

  if (!uploadResponse) {
    throw new ApiError(500, "Failed to update cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: uploadResponse.secure_url,
      },
    },
    {
      new: true, // Returns the updated document
    }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(500, "Failed to update cover image");
  }

  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      data: { user },
      message: "Cover Image updated successfully",
    })
  );
});

const getChannelprofile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        email: 1,
        avatar: 1,
        username: 1,
        fullname: 1,
        coverImage: 1,
        isSubscribed: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
      },
    },
  ]);

  console.log(channel);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }

  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      data: { channel: channel[0] },
      message: "Channel retrieved successfully",
    })
  );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        // Convert id string into an objectId as aggregation directly talks with mongodb without
        // layer of mongoose in between which automatically converts it for us without explicitly telling.
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        // Sub pipelines
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullname: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  console.log(user);

  return res.status(200).json(
    new ApiResponse({
      statusCode: 200,
      data: user[0],
      message: "Watch history fetched successfully",
    })
  );
});

export {
  register,
  login,
  logout,
  changeCurrentPassword,
  getCurrentUser,
  refreshAccessToken,
  generateTokens,
  updateAvatar,
  updateUser,
  updateCoverImage,
  getChannelprofile,
  getWatchHistory,
};
