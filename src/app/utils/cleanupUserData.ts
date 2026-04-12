import { Tag } from "../modules/tags/tags.model";
import { UploadPhoto } from "../modules/uploadPhotos/uploadPhotos.model";
import { User } from "../modules/user/user.model";

export const cleanupUserData = async (userId: string, FREE_STORAGE_LIMIT: number) => {
  try {
    // STEP 1 — TAG CLEANUP (Keep oldest 5)
    const tags = await Tag.find({ author: userId, isDeleted: false }).sort({ createdAt: 1 });

    if (tags.length > 5) {
      const tagsToDelete = tags.slice(5);

      for (const tag of tagsToDelete) {
        await Tag.findByIdAndUpdate(tag._id, { isDeleted: true });
        await UploadPhoto.deleteMany({ tag: tag._id });
      }
    }

    // STEP 2 — STORAGE CLEANUP
    const photos = await UploadPhoto.find({ author: userId }).sort({ createdAt: 1 });
    let totalSize = photos.reduce((sum, p) => sum + p.fileSize, 0);

    if (totalSize > FREE_STORAGE_LIMIT) {
      let extra = totalSize - FREE_STORAGE_LIMIT;
      const newestFirst = await UploadPhoto.find({ author: userId }).sort({ createdAt: -1 });

      for (const photo of newestFirst) {
        if (extra <= 0) break;

        extra -= photo.fileSize;
        await UploadPhoto.findByIdAndDelete(photo._id);
      }
    }

    // Update user remaining free storage
    const remaining = await UploadPhoto.find({ author: userId });
    const newSize = remaining.reduce((s, p) => s + p.fileSize, 0);

    await User.findByIdAndUpdate(userId, { freeStorage: newSize });

  } catch (error) {
    console.error(`❌ Error cleaning data for user ${userId}:`, error);
    throw error;
  }
};
