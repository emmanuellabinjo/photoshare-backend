const { CosmosClient } = require("@azure/cosmos");

let client;
let db;

function getClient() {
  if (!client) {
    client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
    db = client.database(process.env.COSMOS_DATABASE);
  }
  return db;
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function getItem(containerName, id, partitionKey) {
  const container = getClient().container(containerName);
  const { resource } = await container.item(id, partitionKey).read();
  return resource || null;
}

async function createItem(containerName, item) {
  const container = getClient().container(containerName);
  const { resource } = await container.items.create(item);
  return resource;
}

async function upsertItem(containerName, item) {
  const container = getClient().container(containerName);
  const { resource } = await container.items.upsert(item);
  return resource;
}

async function deleteItem(containerName, id, partitionKey) {
  const container = getClient().container(containerName);
  await container.item(id, partitionKey).delete();
}

async function queryItems(containerName, query, parameters = []) {
  const container = getClient().container(containerName);
  const { resources } = await container.items
    .query({ query, parameters })
    .fetchAll();
  return resources;
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function findUserByEmail(email) {
  const results = await queryItems(
    "Users",
    "SELECT * FROM c WHERE c.email = @email",
    [{ name: "@email", value: email }]
  );
  return results[0] || null;
}

async function createUser(user) {
  return createItem("Users", user);
}

// ─── Photos ───────────────────────────────────────────────────────────────────

async function createPhoto(photo) {
  return createItem("Photos", photo);
}

async function getPhotoById(id) {
  // Photos are partitioned by creatorId — query instead of point read
  const results = await queryItems(
    "Photos",
    "SELECT * FROM c WHERE c.id = @id",
    [{ name: "@id", value: id }]
  );
  return results[0] || null;
}

async function listPhotos(searchTerm, limit = 50, offset = 0) {
  let query;
  let parameters;

  if (searchTerm) {
    query = `SELECT * FROM c WHERE 
      CONTAINS(LOWER(c.title), LOWER(@q)) OR 
      CONTAINS(LOWER(c.caption), LOWER(@q)) OR 
      ARRAY_CONTAINS(c.tags, @q, true)
      ORDER BY c._ts DESC OFFSET @offset LIMIT @limit`;
    parameters = [
      { name: "@q", value: searchTerm },
      { name: "@offset", value: offset },
      { name: "@limit", value: limit },
    ];
  } else {
    query = `SELECT * FROM c ORDER BY c._ts DESC OFFSET @offset LIMIT @limit`;
    parameters = [
      { name: "@offset", value: offset },
      { name: "@limit", value: limit },
    ];
  }

  return queryItems("Photos", query, parameters);
}

async function getPhotosByCreator(creatorId) {
  return queryItems(
    "Photos",
    "SELECT * FROM c WHERE c.creatorId = @creatorId ORDER BY c._ts DESC",
    [{ name: "@creatorId", value: creatorId }]
  );
}

async function updatePhoto(photo) {
  return upsertItem("Photos", photo);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

async function createComment(comment) {
  return createItem("Comments", comment);
}

async function getCommentsByPhoto(photoId) {
  return queryItems(
    "Comments",
    "SELECT * FROM c WHERE c.photoId = @photoId ORDER BY c._ts ASC",
    [{ name: "@photoId", value: photoId }]
  );
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

async function createOrUpdateRating(rating) {
  return upsertItem("Ratings", rating);
}

async function getRatingsByPhoto(photoId) {
  return queryItems(
    "Ratings",
    "SELECT * FROM c WHERE c.photoId = @photoId",
    [{ name: "@photoId", value: photoId }]
  );
}

async function getUserRatingForPhoto(photoId, userId) {
  const results = await queryItems(
    "Ratings",
    "SELECT * FROM c WHERE c.photoId = @photoId AND c.userId = @userId",
    [
      { name: "@photoId", value: photoId },
      { name: "@userId", value: userId },
    ]
  );
  return results[0] || null;
}

module.exports = {
  findUserByEmail,
  createUser,
  createPhoto,
  getPhotoById,
  listPhotos,
  getPhotosByCreator,
  updatePhoto,
  createComment,
  getCommentsByPhoto,
  createOrUpdateRating,
  getRatingsByPhoto,
  getUserRatingForPhoto,
  queryItems,
};
