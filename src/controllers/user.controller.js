import jwt from "jsonwebtoken";

import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { COOKIE_OPTIONS, DAY, WEEK } from "../constants.js";

export const generateTokens = async (userId) => {
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

export const register = asyncHandler(async (req, res) => {
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

export const login = asyncHandler(async (req, res) => {
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

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: "" },
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

export const refreshAccessToken = asyncHandler(async (req, res) => {
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
