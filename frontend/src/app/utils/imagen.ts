/**
 * Reescala y comprime una imagen en el cliente antes de previsualizarla o subirla.
 * Evita que las fotos del móvil (12MP, varios MB) agoten la memoria del WebView
 * de iOS al decodificarlas a resolución completa (lo que cerraba la app de golpe).
 *
 * Si algo falla, devuelve el archivo original para no bloquear el flujo.
 */
export async function comprimirImagen(file: File, maxLado = 1600, calidad = 0.7): Promise<File> {
  if (!file || !file.type?.startsWith('image/')) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const ladoMayor = Math.max(width, height);

    if (ladoMayor > maxLado) {
      const escala = maxLado / ladoMayor;
      width = Math.round(width * escala);
      height = Math.round(height * escala);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, 'image/jpeg', calidad)
    );

    // Liberar memoria del canvas explícitamente
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) return file;
    const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Lee un File como data URL (para previsualización). */
export function fileADataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
