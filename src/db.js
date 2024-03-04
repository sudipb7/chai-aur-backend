import mongoose from "mongoose";

export const connectToDB = async () => {
  try {
    const instance = await mongoose.connect(process.env.DATABASE_URL);
    console.log(`DB_CONNECTED at ${instance.connection.host}`);
  } catch (error) {
    console.log("DB_ERROR", error);
    process.exit(1);
  }
};
