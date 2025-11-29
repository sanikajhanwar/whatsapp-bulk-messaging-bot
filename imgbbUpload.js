import fetch from 'node-fetch'; // or native fetch if your Node.js version supports

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

export async function uploadImageToImgBB(imageData) {
  // imageData can be a base64 string or a public direct image URL
  if (!IMGBB_API_KEY) throw new Error('IMGBB_API_KEY environment variable not set');

  const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;

  const formData = new URLSearchParams();
  formData.append('image', imageData);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ImgBB upload failed: ${errorText}`);
    }

    const data = await response.json();
    if (data && data.success && data.data && data.data.url) {
      return data.data.url; // direct image URL to use for WhatsApp media sending
    } else {
      throw new Error('Invalid ImgBB response format');
    }
  } catch (error) {
    console.error('Error uploading image to ImgBB:', error);
    throw error;
  }
}
