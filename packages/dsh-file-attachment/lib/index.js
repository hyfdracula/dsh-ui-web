import { AttachmentError, AttachmentError as AttachmentError$1, AttachmentId } from "@deepseek-ai/dsh-attachment";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
//#region src/store.ts
/**
* Shared content-addressing and durable-directory helpers for the file
* attachment provider (migrated from DSH fork `attachment-local/src/store.ts`,
* image-free subset).
* @module @captain1275/dsh-file-attachment/store
*/
const ID_PATTERN = /^sha256:([a-f0-9]{64})$/;
const durableHomes = /* @__PURE__ */ new Set();
function digest(data) {
	return createHash("sha256").update(data).digest("hex");
}
function displayName(value) {
	if (value === void 0) return void 0;
	const clean = value.slice(Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\")) + 1).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
	return clean === "" ? void 0 : clean;
}
function objectPath(root, sha256) {
	return join(root, "objects", sha256.slice(0, 2), sha256);
}
function ensureReference(ref) {
	const match = ID_PATTERN.exec(String(ref.attachmentId));
	if (match?.[1] === void 0) throw new AttachmentError$1("Attachment reference is invalid.", "INVALID_ATTACHMENT_REF");
	return match[1];
}
async function syncDirectory$1(path) {
	/* v8 ignore next -- Windows cannot open directory handles; NTFS metadata journaling owns entry durability there. */
	if (process.platform === "win32") return;
	const handle = await open(path, constants.O_RDONLY);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
/**
* Create one private directory tree and persist every ancestor entry up to a
* caller-vouched durable boundary.
*/
async function ensureDurableDirectory(path, boundary) {
	const target = resolve(path);
	const stop = resolve(boundary);
	await mkdir(target, {
		recursive: true,
		mode: 448
	});
	await chmod(target, 448);
	let level = target;
	while (level !== stop) {
		const parent = dirname(level);
		await syncDirectory$1(parent);
		/* v8 ignore next -- filesystem-root guard */
		if (parent === level) return;
		level = parent;
	}
}
/** Establish this process's proof that one DSH_HOME entry and every ancestor are durable. */
async function ensureDurableHome(path) {
	const home = resolve(path);
	if (!durableHomes.has(home)) {
		await ensureDurableDirectory(home, parse(home).root);
		durableHomes.add(home);
	}
	return home;
}
//#endregion
//#region src/file-store.ts
/**
* Content-addressed, owner-private local storage for generic file attachments.
* Migrated from DSH fork `attachment-local/src/file-store.ts` (identical
* logic); the File types are re-declared here so this package builds against
* the released `@deepseek-ai/dsh-attachment` (which predates the fork's file
* face) while staying wire-compatible with the fork at runtime.
* @module @captain1275/dsh-file-attachment/file-store
*/
/**
* Run the admission policy for one generic file without touching storage.
* @param input - encoded bytes and declared metadata.
* @param limits - resolved storage policy.
*/
function validateFile(input, limits) {
	if (input.data.byteLength === 0) throw new AttachmentError$1("File is empty.", "INVALID_FILE");
	if (input.data.byteLength > limits.maxFileBytes) throw new AttachmentError$1("File exceeds the configured byte limit.", "FILE_TOO_LARGE");
}
/**
* Save and verify immutable file bytes below a versioned attachment root.
* @param root - absolute `DSH_HOME/attachments/v1` root.
* @param input - encoded bytes and declared metadata.
* @param limits - resolved storage policy.
* @returns durable content-addressed reference.
*/
async function saveFile(root, input, limits) {
	if (input.data.byteLength === 0) throw new AttachmentError$1("File is empty.", "INVALID_FILE");
	if (input.data.byteLength > limits.maxFileBytes) throw new AttachmentError$1("File exceeds the configured byte limit.", "FILE_TOO_LARGE");
	const sha256 = digest(input.data);
	const bucket = join(root, "objects", sha256.slice(0, 2));
	const staging = join(root, "tmp");
	const boundary = await ensureDurableHome(dirname(dirname(resolve(root))));
	await ensureDurableDirectory(bucket, boundary);
	await ensureDurableDirectory(staging, boundary);
	const temporary = join(staging, randomUUID());
	const target = objectPath(root, sha256);
	let handle;
	try {
		handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 384);
		await handle.writeFile(input.data);
		await handle.sync();
		await handle.close();
		handle = void 0;
		try {
			await link(temporary, target);
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
			if (digest(new Uint8Array(await readFile(target))) !== sha256) throw new AttachmentError$1("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");
		}
		await syncDirectory(bucket);
		await syncDirectory(join(root, "objects"));
		await unlink(temporary);
	} catch (error) {
		if (handle !== void 0) await handle.close().catch(() => {});
		await unlink(temporary).catch((cleanupError) => {
			if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) throw cleanupError;
		});
		if (error instanceof AttachmentError$1) throw error;
		throw new AttachmentError$1("Unable to persist file attachment.", "ATTACHMENT_WRITE_FAILED", { cause: error });
	}
	const name = displayName(input.name);
	return {
		attachmentId: AttachmentId(`sha256:${sha256}`),
		mediaType: input.mediaType,
		bytes: input.data.byteLength,
		...name !== void 0 ? { name } : {}
	};
}
/**
* Read and verify one content-addressed generic file.
* @param root - absolute `DSH_HOME/attachments/v1` root.
* @param ref - reference recorded in the session log.
* @param signal - optional cancellation for filesystem and verification work.
* @returns verified bytes and reference.
*/
async function readFile$1(root, ref, signal) {
	signal?.throwIfAborted();
	const sha256 = ensureReference(ref);
	let data;
	try {
		data = new Uint8Array(await readFile(objectPath(root, sha256), { signal }));
	} catch (error) {
		signal?.throwIfAborted();
		if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new AttachmentError$1("Attachment object is missing.", "ATTACHMENT_NOT_FOUND");
		throw new AttachmentError$1("Unable to read file attachment.", "ATTACHMENT_READ_FAILED", { cause: error });
	}
	signal?.throwIfAborted();
	if (digest(data) !== sha256) throw new AttachmentError$1("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");
	if (data.byteLength !== ref.bytes) throw new AttachmentError$1("Stored attachment metadata does not match its reference.", "ATTACHMENT_CORRUPT");
	return {
		ref,
		data
	};
}
async function syncDirectory(path) {
	if (process.platform === "win32") return;
	const handle = await open(path, constants.O_RDONLY);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
//#endregion
//#region src/index.ts
/** Sentinel for "no limit": matches the DSH fork's UNLIMITED_ATTACHMENT. */
const UNLIMITED_ATTACHMENT = Number.MAX_SAFE_INTEGER;
/** Default file limits: unlimited by default (mirrors the fork's defaults). */
const DEFAULT_FILE_LIMITS = Object.freeze({
	maxFileBytes: UNLIMITED_ATTACHMENT,
	maxFilesPerMessage: UNLIMITED_ATTACHMENT,
	maxMessageFileBytes: UNLIMITED_ATTACHMENT
});
/**
* Synchronous admission policy for one generic file (no storage touch).
* The async store method awaits this; exposed separately so a thin delegating
* layer can preserve synchronous throw semantics.
* @param input - encoded bytes and declared metadata.
* @param limits - resolved storage policy.
*/
function validateFileSync(input, limits) {
	validateFile(input, limits);
}
/**
* Durable generic-file attachment store: content-addressed sha256 objects
* below `DSH_HOME/attachments/v1`, with integrity verification on read.
* This is the file-only face of the DSH attachment seam; a deployment may use
* it standalone or compose it beside an image store.
*/
var FileAttachmentStore = class FileAttachmentStore {
	/** Absolute storage root (versioned). */
	root;
	/** Deployment-resolved file policy (unlimited by default). */
	fileLimits;
	/**
	* @param root - absolute `DSH_HOME/attachments/v1` root.
	* @param limits - resolved file policy; defaults to unlimited.
	*/
	constructor(root, limits = DEFAULT_FILE_LIMITS) {
		this.root = root;
		this.fileLimits = Object.freeze({ ...limits });
	}
	/** Run the admission policy for one generic file without touching storage. */
	async validateFile(input) {
		validateFile(input, this.fileLimits);
	}
	/** Validate and durably commit one generic file; returns a content-addressed reference. */
	async saveFile(input) {
		return saveFile(this.root, input, this.fileLimits);
	}
	/** Read and verify one content-addressed generic file. */
	async readFile(ref, signal) {
		return readFile$1(this.root, ref, signal);
	}
	/** Convenience factory: build a store rooted at `${dshHome}/attachments/v1`. */
	static atDshHome(dshHome, limits) {
		return new FileAttachmentStore(`${dshHome.replace(/[\\/]+$/, "")}/attachments/v1`, limits);
	}
};
//#endregion
export { AttachmentError, DEFAULT_FILE_LIMITS, FileAttachmentStore, UNLIMITED_ATTACHMENT, validateFileSync };
