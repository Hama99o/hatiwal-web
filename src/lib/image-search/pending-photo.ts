/**
 * Search by image: the photo the buyer picked, handed from the 📷 button (in
 * the header, on every page) to the /image-search page. In memory only — never
 * in the URL, storage or a cookie — so a reload of the results page shows
 * "pick a photo" again instead of re-sending a photo the buyer may not expect.
 *
 * Each pick gets an id that goes in the URL (?p=…): Back from a listing returns
 * to the same results from the React Query cache without a new upload.
 */
export interface PendingPhoto {
  id: string;
  photo: Blob;
  previewUrl: string;
}

let current: PendingPhoto | null = null;

export function setPendingPhoto(photo: Blob): PendingPhoto {
  if (current) URL.revokeObjectURL(current.previewUrl);
  current = {
    id: Math.random().toString(36).slice(2, 10),
    photo,
    previewUrl: URL.createObjectURL(photo),
  };
  return current;
}

export function getPendingPhoto(id: string | null | undefined): PendingPhoto | null {
  return current && id && current.id === id ? current : null;
}
