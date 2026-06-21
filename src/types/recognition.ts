export interface RecognitionLocation {
  camera_id: string;
  camera_label: string;
  address: string;
  city: string;
  state: string;
}

export interface RecognitionEvent {
  id: string;
  person_id: string;
  person_name: string;
  location: RecognitionLocation;
  timestamp: string;
  confidence: number;
  access_granted: boolean;
}
