import { z } from "zod";
export const attachmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  dataURL: z
    .string()
    .max(4_200_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/),
});
export type ImageAttachment = z.infer<typeof attachmentSchema>;
export function imageSignature(bytes: Uint8Array, mime: string) {
  return mime === "image/png"
    ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
    : mime === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/webp"
        ? String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
        : false;
}
export async function prepareImage(file: File): Promise<ImageAttachment> {
  if (file.size > 3_000_000)
    throw new Error(
      "Image limit is 3 MB. Crop the screenshot or choose a smaller image.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageSignature(bytes, file.type))
    throw new Error("Choose a valid PNG, JPEG or WebP image.");
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
  return attachmentSchema.parse({
    id: crypto.randomUUID(),
    name: file.name.replace(/[\u0000-\u001f]/g, "").slice(0, 100) || "image",
    mime: file.type,
    dataURL,
  });
}
