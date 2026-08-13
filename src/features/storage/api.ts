import { apiRequest } from "@/services/api/client";

export async function uploadListCover(listId: string, file: File): Promise<void> {
  const declaration = { purpose: "list-cover", mimeType: file.type, sizeBytes: file.size } as const;
  const { upload } = await apiRequest<{
    upload: { key: string; uploadUrl: string; headers: Record<string, string> };
  }>("/storage/uploads/presign", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(declaration),
  });
  const sent = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!sent.ok) throw new Error("Le stockage a refusé le fichier.");
  await apiRequest("/storage/uploads/verify", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ ...declaration, key: upload.key, listId }),
  });
}

export async function uploadProductImage(file: File): Promise<string> {
  const declaration = {
    purpose: "product-image",
    mimeType: file.type,
    sizeBytes: file.size,
  } as const;
  const { upload } = await apiRequest<{
    upload: { key: string; uploadUrl: string; headers: Record<string, string> };
  }>("/storage/uploads/presign", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(declaration),
  });
  const sent = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!sent.ok) throw new Error("Le stockage a refusé le fichier.");
  await apiRequest("/storage/uploads/verify", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ ...declaration, key: upload.key }),
  });
  return upload.key;
}
