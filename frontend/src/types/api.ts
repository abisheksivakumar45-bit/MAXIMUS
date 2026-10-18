/** Shapes returned by the MAXIMUS backend health endpoints. */

export interface HealthResponse {
  service: string;
  version: string;
  environment: string;
  status: string;
  timestamp: string;
}

export interface LivenessResponse {
  status: string;
}

export interface DatabaseStatus {
  connected: boolean;
}

export interface ReadinessResponse {
  status: string;
  database: DatabaseStatus;
}
