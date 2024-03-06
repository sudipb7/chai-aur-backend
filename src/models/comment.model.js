import mongooose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const CommentSchema = new mongooose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    video: {
      type: mongooose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    owner: {
      type: mongooose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

CommentSchema.plugin(mongooseAggregatePaginate);

export const Comment =
  mongooose.models.Comment || mongooose.model("Comment", CommentSchema);
