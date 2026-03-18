const { BlobServiceClient } = require("@azure/storage-blob");
const { randomUUID: uuidv4 } = require("crypto");

let blobServiceClient;

function getClient() {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.STORAGE_CONNECTION_STRING
    );
  }
  return blobServiceClient;
}

/**
 * Upload a file buffer to Azure Blob Storage.
 * @param {Buffer} buffer - File data
 * @param {string} originalName - Original filename (used for extension)
 * @param {string} mimeType - MIME type e.g. "image/jpeg"
 * @param {string} containerName - "photos" or "thumbnails"
 * @returns {string} Public URL of the uploaded blob
 */
async function uploadBlob(buffer, originalName, mimeType, containerName) {
  const client = getClient();
  const containerClient = client.getContainerClient(containerName);

  const ext = originalName.split(".").pop().toLowerCase() || "jpg";
  const blobName = `${uuidv4()}.${ext}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return blockBlobClient.url;
}

/**
 * Delete a blob by its full URL.
 */
async function deleteBlob(blobUrl, containerName) {
  try {
    const client = getClient();
    const containerClient = client.getContainerClient(containerName);
    const blobName = blobUrl.split("/").pop().split("?")[0];
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.deleteIfExists();
  } catch (err) {
    console.warn("[BLOB] Could not delete blob:", err.message);
  }
}

module.exports = { uploadBlob, deleteBlob };
