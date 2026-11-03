import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type DrmSystem = 'widevine' | 'fairplay';
export type DrmPlatform = 'android' | 'ios' | 'web' | 'webos' | 'tvos';
export interface DrmLicenseRequest { sessionId: string; contentId: string; drmSystem: DrmSystem; platform: DrmPlatform; userId: string; challenge: Buffer }
export interface DrmProvider { requestLicense(request: DrmLicenseRequest): Promise<Buffer> }

/** No DRM provider is configured. Never manufacture a license or claim protection. */
@Injectable()
export class DrmService implements DrmProvider {
  async requestLicense(_request: DrmLicenseRequest): Promise<Buffer> {
    void _request; // Requests are deliberately not forwarded without an approved provider.
    throw new ServiceUnavailableException('DRM license provider is not integrated');
  }
  isConfigured(): boolean { return false; }
}
