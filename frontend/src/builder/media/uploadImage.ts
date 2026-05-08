import { adminService } from "../../services/admin.service";

export async function uploadImageToCdn(file: File): Promise<string> {
  // Reuse existing backend flow (/upload) that returns https URL (Cloudinary).
  return adminService.uploadImage(file);
}

