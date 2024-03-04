import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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

  const avatarPath = req.files?.avatar[0]?.path;
  const coverImagePath = req.files?.coverImage[0]?.path;

  if (!avatarPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarPath);
  let coverImage;
  if (coverImagePath) {
    coverImage = await uploadOnCloudinary(coverImagePath);
  }

  console.log(avatarPath);
  console.log(avatar);

  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    email: email.toLowerCase(),
    password,
    avatar: avatar.secure_url,
    coverImage: coverImage?.secure_url || "",
  });

  if (!user) {
    throw new ApiError(500, "Failed to create user");
  }

  const userRes = { ...user };

  delete userRes.password;
  delete userRes.refreshToken;

  return res.status(201).json(
    new ApiResponse({
      status: 201,
      success: true,
      data: { user: userRes },
      message: "User created successfully",
    })
  );
});
