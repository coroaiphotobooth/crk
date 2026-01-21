import { GalleryItem } from '../types';

// Key untuk menyimpan URL Script Google di LocalStorage browser
const API_URL_KEY = 'COROAI_GAS_URL_V3';

// DEFAULT CONFIGURATION
const DEFAULT_SCRIPT_ID = "AKfycbz7cCdGzmKUA3xPJgiEQpe5p7B2CqcrGYK0LfxN9kogXp2WuNuIZDUOQSjEGgGFzJLL";
const DEFAULT_URL = `https://script.google.com/macros/s/${DEFAULT_SCRIPT_ID}/exec`;
const DEFAULT_FOLDER_ID = "1-96Bx1y03scOWLw1cT6FAhbLPAFSHtLb";

export const getApiUrl = (): string => {
  return localStorage.getItem(API_URL_KEY) || DEFAULT_URL;
};

export const setApiUrl = (url: string) => {
  localStorage.setItem(API_URL_KEY, url);
};

const getUrl = () => {
  const url = getApiUrl();
  if (!url) throw new Error("Google Script URL Error.");
  return url;
};

// --- API FUNCTIONS ---

export const getGalleryItems = async (): Promise<GalleryItem[]> => {
  try {
    // Append timestamp to prevent browser caching
    const response = await fetch(`${getUrl()}?action=get&t=${Date.now()}`, {
      method: 'GET',
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    console.error("Failed to load gallery:", error);
    return [];
  }
};

export const saveGalleryItem = async (item: GalleryItem): Promise<void> => {
  const payload = JSON.stringify({
    action: 'save',
    folderId: DEFAULT_FOLDER_ID,
    data: JSON.stringify(item)
  });

  // CRITICAL FIX: Do NOT add ?action=save to the URL.
  // Sending it in the URL confuses some GAS implementations into checking e.parameter.data 
  // (which is undefined) instead of parsing the POST body.
  const url = getUrl();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', 
    },
    body: payload
  });
  
  const text = await response.text();
  try {
      const resData = JSON.parse(text);
      if (resData.error) throw new Error(resData.error);
  } catch (e) {
      // If response is not JSON (e.g. standard success message text), just warn but don't crash
      // unless it looks like an error
      const lowerText = text.toLowerCase();
      if (lowerText.includes("error") || lowerText.includes("syntaxerror")) {
          throw new Error("Server Error: " + text);
      }
      if (!lowerText.includes("success")) {
          console.warn("Non-JSON response:", text);
      }
  }
};

export const deleteGalleryItem = async (id: string): Promise<void> => {
  // MENGGUNAKAN GET UNTUK DELETE
  // Lebih stabil untuk GAS karena parameter pasti masuk via URL
  // encodeURIComponent sangat penting untuk ID yang mengandung karakter spesial
  const url = `${getUrl()}?action=delete&id=${encodeURIComponent(id)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); 

  try {
      // Gunakan mode no-cors jika perlu, tapi GET standard biasanya aman.
      // Kita coba standard GET dulu.
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });

      const text = await response.text();
      try {
          const resData = JSON.parse(text);
          if (resData.error) throw new Error(resData.error);
      } catch (e) {
           const lowerText = text.toLowerCase();
           if (!lowerText.includes("success") && !lowerText.includes("berhasil") && !lowerText.includes("deleted")) {
              // Jika response kosong atau aneh, tapi status 200, kita anggap sukses di sisi client (Optimistic)
              // namun log warning.
              console.warn("Delete response warning:", text);
           }
      }
  } catch (err: any) {
      if (err.name === 'AbortError') {
          throw new Error("Request Timeout: Server lambat merespon.");
      }
      throw err;
  } finally {
      clearTimeout(timeoutId);
  }
};

export const exportGalleryData = async () => "";
export const importGalleryData = async () => 0;