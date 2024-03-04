import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (path) => {
  try {
    if (!path) return null;
    const response = await cloudinary.uploader.upload(path, {
      resource_type: "auto",
    });
    console.log(response.url);
    return response;
  } catch (error) {
    console.log("FILE_UPLOAD_ERROR", error);
    fs.unlinkSync(path);
    return null;
  }
};

export { uploadOnCloudinary };
