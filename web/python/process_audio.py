import argparse
import json
import shutil
import sys
import uuid
from pathlib import Path
from typing import Dict, List, Tuple

import librosa
import numpy as np
import soundfile as sf
from basic_pitch import ICASSP_2022_MODEL_PATH  # type: ignore
from basic_pitch.inference import Model, predict
from music21 import converter, pitch, tempo, stream
from spleeter.separator import Separator


def ensure_dirs(base_dir: Path) -> Dict[str, Path]:
    dirs = {
        "audio": base_dir / "audio",
        "midi": base_dir / "midi",
        "musicxml": base_dir / "musicxml",
        "notes": base_dir / "notes",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def duplicate_if_stereo(data: np.ndarray) -> np.ndarray:
    if data.ndim == 1:
        return np.stack([data, data], axis=1)
    if data.ndim == 2 and data.shape[1] == 1:
        return np.tile(data, (1, 2))
    return data


def make_guitar_from_other(other_path: Path, guitar_path: Path, residual_path: Path) -> Tuple[bool, bool]:
    audio, sr = librosa.load(other_path, sr=None, mono=True)
    if audio.size == 0:
        return False, False
    harmonic, percussive = librosa.effects.hpss(audio)
    harmonic_energy = float(np.sqrt(np.mean(harmonic**2)))
    percussive_energy = float(np.sqrt(np.mean(percussive**2)))

    if harmonic_energy > 1e-4:
        sf.write(guitar_path, duplicate_if_stereo(harmonic), sr)
        guitar_present = True
    else:
        guitar_present = False

    if percussive_energy > 1e-4:
        sf.write(residual_path, duplicate_if_stereo(percussive), sr)
        residual_present = True
    else:
        residual_present = False

    return guitar_present, residual_present


def midi_note_name(number: int) -> str:
    return pitch.Pitch(midi=number).nameWithOctave


def quantize_tempo(midi_stream: stream.Stream) -> float:
    tempos = midi_stream.recurse().getElementsByClass(tempo.MetronomeMark)
    if tempos:
        return float(np.median([t.number for t in tempos if t.number]))
    return 120.0


def analyze_track(model: Model, audio_path: Path, track_slug: str, track_label: str, dirs: Dict[str, Path]) -> Dict:
    target_audio_path = dirs["audio"] / f"{track_slug}.wav"
    if audio_path != target_audio_path:
        shutil.copyfile(audio_path, target_audio_path)

    audio_input = Path(target_audio_path)
    model_output, midi_data, note_events = predict(
        audio_input,
        model,
        onset_threshold=0.5,
        frame_threshold=0.3,
        minimum_note_length=90.0,
        minimum_frequency=None,
        maximum_frequency=None,
        multiple_pitch_bends=False,
        melodia_trick=True,
        debug_file=None,
        midi_tempo=120.0,
    )

    midi_path = dirs["midi"] / f"{track_slug}.mid"
    midi_data.write(str(midi_path))

    exported_musicxml_path = dirs["musicxml"] / f"{track_slug}.musicxml"
    parsed_score = converter.parse(str(midi_path))
    parsed_score.write("musicxml", str(exported_musicxml_path))

    note_list: List[Dict] = []
    for start_time, end_time, midi_number, amplitude, _ in note_events:
        duration = max(float(end_time) - float(start_time), 0.0)
        note_list.append(
            {
                "start": round(float(start_time), 6),
                "duration": round(duration, 6),
                "pitchMidi": int(midi_number),
                "pitchName": midi_note_name(int(midi_number)),
                "velocity": float(amplitude),
            }
        )

    note_summary_path = dirs["notes"] / f"{track_slug}.json"
    with open(note_summary_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "track": track_label,
                "tempo": quantize_tempo(parsed_score),
                "notes": note_list,
            },
            handle,
            ensure_ascii=False,
        )

    return {
        "id": track_slug,
        "label": track_label,
        "audio": str(target_audio_path.relative_to(dirs["audio"].parent)),
        "midi": str(midi_path.relative_to(dirs["audio"].parent)),
        "musicxml": str(exported_musicxml_path.relative_to(dirs["audio"].parent)),
        "notes": str(note_summary_path.relative_to(dirs["audio"].parent)),
        "noteEvents": note_list,
    }


def run_separator(input_audio: Path, temp_dir: Path) -> Dict[str, Path]:
    separator = Separator("spleeter:5stems")
    separator.separate_to_file(
        str(input_audio),
        str(temp_dir),
        filename_format="{instrument}.wav",
    )
    stem_dir = temp_dir / input_audio.stem
    stems = {
        "vocals": stem_dir / "vocals.wav",
        "piano": stem_dir / "piano.wav",
        "bass": stem_dir / "bass.wav",
        "drums": stem_dir / "drums.wav",
        "other": stem_dir / "other.wav",
    }
    return stems


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to the input audio file.")
    parser.add_argument("--output", required=True, help="Directory where results should be stored.")
    parser.add_argument("--job-id", required=False, help="Optional job identifier.")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    output_base = Path(args.output).expanduser().resolve()
    output_base.mkdir(parents=True, exist_ok=True)
    staging_dir = output_base / "staging"
    staging_dir.mkdir(parents=True, exist_ok=True)

    stems = run_separator(input_path, staging_dir)
    model = Model(ICASSP_2022_MODEL_PATH)
    directories = ensure_dirs(output_base)

    results = []
    track_order = [
        ("vocals", "vocals", "Вокал"),
        ("piano", "piano", "Фортепиано / клавишные"),
        ("bass", "bass", "Бас"),
        ("drums", "drums", "Ударные / перкуссия"),
    ]

    for stem_key, slug, label in track_order:
        if stems[stem_key].exists():
            results.append(analyze_track(model, stems[stem_key], slug, label, directories))

    guitar_generated = False
    other_present = False
    temp_root = directories["audio"].parent
    guitar_path = temp_root / "temp_guitar.wav"
    other_residual_path = temp_root / "temp_other.wav"

    if stems["other"].exists():
        guitar_generated, other_present = make_guitar_from_other(stems["other"], guitar_path, other_residual_path)

    guitar_label = "Гитара"
    other_label = "Другие инструменты"

    if guitar_generated and guitar_path.exists():
        results.append(analyze_track(model, guitar_path, "guitar", guitar_label, directories))
        guitar_path.unlink(missing_ok=True)
    else:
        results.append(
            {
                "id": "guitar",
                "label": guitar_label,
                "audio": None,
                "midi": None,
                "musicxml": None,
                "notes": None,
                "noteEvents": [],
                "status": "неопознанный инструмент",
            }
        )

    if other_present and other_residual_path.exists():
        results.append(analyze_track(model, other_residual_path, "other", other_label, directories))
        other_residual_path.unlink(missing_ok=True)
    elif stems["other"].exists():
        results.append(analyze_track(model, stems["other"], "other", other_label, directories))
    else:
        results.append(
            {
                "id": "other",
                "label": other_label,
                "audio": None,
                "midi": None,
                "musicxml": None,
                "notes": None,
                "noteEvents": [],
            }
        )

    job_id = args.job_id or str(uuid.uuid4())

    try:
        print(
            json.dumps(
                {
                    "jobId": job_id,
                    "tracks": results,
                },
                ensure_ascii=False,
            )
        )
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
