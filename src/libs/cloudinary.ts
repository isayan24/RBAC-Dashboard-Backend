import crypto from "crypto";

let cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
const apiKey = process.env.CLOUDINARY_API_KEY!;
const apiSecret = process.env.CLOUDINARY_API_SECRET!;

const generateSignature = (params: Record<string, any>, secret: string) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(sortedParams + secret)
    .digest("hex");
};

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  mimeType: string,
  folderName = "rbac_dashboard",
) => {
  try {
    const base64Data = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const paramsToSign = {
      folder: folderName,
      timestamp: timestamp,
    };

    const signature = generateSignature(paramsToSign, apiSecret);

    const formData = new FormData();
    formData.append("file", base64Data);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("folder", folderName);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Cloudinary API responded with status ${response.status}: ${errText}`,
      );
    }

    const data = (await response.json()) as any;
    return {
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    throw new Error(error.message || "Failed to upload file to Cloudinary");
  }
};
