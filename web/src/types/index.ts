export type NoteEvent = {
  start: number;
  duration: number;
  pitchMidi: number;
  pitchName: string;
  velocity: number;
};

export type TrackResult = {
  id: string;
  label: string;
  audio: string | null;
  midi: string | null;
  musicxml: string | null;
  notes: string | null;
  noteEvents?: NoteEvent[];
  status?: string;
};

export type ProcessResponse = {
  jobId: string;
  tracks: TrackResult[];
  archive: string;
};
