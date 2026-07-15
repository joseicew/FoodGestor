import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const CLAVE_CREDENCIALES = 'foodgestor_credenciales_login';

export interface CredencialesGuardadas {
  email: string;
  password: string;
}

/**
 * Da acceso rápido a la app con Face ID/Touch ID: guarda las credenciales del
 * último login en el Keychain seguro del dispositivo (nunca en nuestro backend)
 * y solo las devuelve tras una confirmación biométrica exitosa.
 */
@Injectable({ providedIn: 'root' })
export class BiometricAuthService {

  private esNativo(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** True si el dispositivo soporta biometría y el usuario la tiene configurada */
  async disponible(): Promise<boolean> {
    if (!this.esNativo()) return false;
    try {
      const resultado = await BiometricAuth.checkBiometry();
      return resultado.isAvailable;
    } catch {
      return false;
    }
  }

  async etiqueta(): Promise<string> {
    if (!this.esNativo()) return 'biometría';
    try {
      const resultado = await BiometricAuth.checkBiometry();
      return resultado.biometryType === BiometryType.faceId ? 'Face ID' : 'Touch ID';
    } catch {
      return 'biometría';
    }
  }

  async icono(): Promise<string> {
    if (!this.esNativo()) return '🔐';
    try {
      const resultado = await BiometricAuth.checkBiometry();
      return resultado.biometryType === BiometryType.faceId ? '🙂' : '👆';
    } catch {
      return '🔐';
    }
  }

  /** Lanza el prompt nativo de confirmación biométrica. Rechaza si el usuario cancela o falla */
  async confirmar(motivo: string): Promise<void> {
    await BiometricAuth.authenticate({ reason: motivo, cancelTitle: 'Cancelar', iosFallbackTitle: '' });
  }

  async hayCredencialesGuardadas(): Promise<boolean> {
    if (!this.esNativo()) return false;
    try {
      const valor = await SecureStorage.get(CLAVE_CREDENCIALES);
      return !!valor;
    } catch {
      return false;
    }
  }

  async guardarCredenciales(email: string, password: string): Promise<void> {
    if (!this.esNativo()) return;
    await SecureStorage.set(CLAVE_CREDENCIALES, { email, password });
  }

  async obtenerCredenciales(): Promise<CredencialesGuardadas | null> {
    if (!this.esNativo()) return null;
    try {
      const valor = await SecureStorage.get(CLAVE_CREDENCIALES);
      return (valor as unknown as CredencialesGuardadas) || null;
    } catch {
      return null;
    }
  }

  async borrarCredenciales(): Promise<void> {
    if (!this.esNativo()) return;
    try {
      await SecureStorage.remove(CLAVE_CREDENCIALES);
    } catch {
      // no había nada que borrar
    }
  }
}
