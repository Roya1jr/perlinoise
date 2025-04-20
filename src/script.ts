//HTML
const loadingSpinner = `<span class="icon-[svg-spinners--blocks-scale] text-2xl animate-flip-down"></span>`;
const playingSpinner = `<span class="icon-[svg-spinners--bars-scale-middle] text-2xl animate-flip-down"></span>`;
const genButton = `<button id="generateButton" class="btn btn-outline btn-success">Generate</button>`;

//Elements
const audioPlayer = document.getElementById("audioPlayer") as HTMLAudioElement;
const buttonContainer = document.getElementById("buttonContainer");
const audioContainer = document.getElementById("audio-container");

//CONSTS
const dbName = "AudioStorageDB";
const storeName = "audios";
const dbVersion = 1;
const audioKey = "generatedNoise";

const ShowLoading = (): void => {
	if (buttonContainer !== null) {
		buttonContainer.innerHTML = loadingSpinner;
	} else {
		console.log("Button Container Missing");
	}
};
const ShowGenerateButton = (): void => {
	if (buttonContainer !== null) {
		buttonContainer.innerHTML = genButton;
		const generateButton = document.getElementById("generateButton");
		if (generateButton !== null) {
			generateButton.addEventListener("click", GenerateNoise);
		} else {
			console.log("Button Container/Button Missing");
		}
	} else {
		console.log("Button Container/Button Missing");
	}
};

const OpenDataBase = async (): Promise<IDBDatabase> => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, dbVersion);
		request.onerror = () => reject("Error opening IndexedDB");
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = (event) => {
			if (event.target !== null) {
				const db = (event.target as IDBOpenDBRequest).result as IDBDatabase;
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName);
				}
			}
		};
	});
};

const SaveAudioToIndexDB = async (blob: Blob) => {
	return OpenDataBase().then((db) => {
		return new Promise<void>((resolve, reject) => {
			const tx = db.transaction(storeName, "readwrite");
			const store = tx.objectStore(storeName);
			const request = store.put(blob, audioKey);
			request.onsuccess = () => resolve();
			request.onerror = () => reject("Failed to store audio blob");
		});
	});
};

const LoadAudioFromIndexedDB = async (): Promise<Blob | undefined> => {
	const db = await OpenDataBase();
	return new Promise<Blob | undefined>((resolve, reject) => {
		const tx = db.transaction(storeName, "readonly");
		const store = tx.objectStore(storeName);
		const request = store.get(audioKey);
		request.onsuccess = () => {
			const result = request.result;
			if (result instanceof Blob) {
				resolve(result);
			} else {
				resolve(undefined);
			}
		};
		request.onerror = () => reject("Failed to store audio blob");
	});
};

const LoadAudioFromStorage = async () => {
	ShowLoading();
	try {
		const blob = await LoadAudioFromIndexedDB();
		if (blob) {
			const url = URL.createObjectURL(blob as Blob);
			if (audioPlayer && buttonContainer) {
				audioPlayer.src = url;
				audioPlayer.loop = true;
				audioPlayer.oncanplaythrough = () => {
					if (buttonContainer !== null) {
						buttonContainer.innerHTML = playingSpinner;
					}
					audioPlayer.oncanplaythrough = null;
				};
				audioPlayer.onerror = () => {
					console.warn("Stored audio is invalid or inaccessible");
					ShowGenerateButton();
					audioPlayer.onerror = null;
				};

				audioPlayer.play().catch((err) => {
					console.warn("Autoplay blocked. User must interact first.", err);
				});
			} else {
				ShowGenerateButton();
			}
		} else {
			ShowGenerateButton();
		}
	} catch (err) {
		console.error("Error loading audio: ", err);
		ShowGenerateButton();
	}
};

const WriteString = (
	view: DataView<ArrayBuffer>,
	off_number: number,
	str: string,
) => {
	str.split("").forEach((char, index) => {
		view.setUint8(off_number + index, char.charCodeAt(0));
	});
};

const CreateWave = async (
	audio_data: Float32Array,
	sample_rate: number,
): Promise<ArrayBuffer> => {
	const num_channels = 1;
	const bits_per_sample = 32;
	const byte_rate = sample_rate * num_channels * (bits_per_sample / 8);
	const block_align = num_channels * (bits_per_sample / 8);
	const data_size = audio_data.length * (bits_per_sample / 8);
	const file_size = 44 + data_size;

	const buffer = new ArrayBuffer(file_size);
	const view = new DataView(buffer);

	WriteString(view, 0, "RIFF");
	view.setUint32(4, file_size - 8, true);
	WriteString(view, 8, "WAVE");

	WriteString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 3, true);
	view.setUint16(22, num_channels, true);
	view.setUint32(24, sample_rate, true);
	view.setUint32(28, byte_rate, true);
	view.setUint16(32, block_align, true);
	view.setUint16(34, bits_per_sample, true);

	WriteString(view, 36, "data ");
	view.setUint32(40, data_size, true);

	audio_data.forEach((sample, index) => {
		view.setFloat32(44 + index * 4, sample, true);
	});

	return buffer;
};

const FinishAudioGen = async (
	audio_data: Float32Array,
	sample_rate: number,
) => {
	try {
		const wav_buffer = await CreateWave(audio_data, sample_rate);
		const blob = new Blob([wav_buffer], { type: "audio/wav" });
		const url = URL.createObjectURL(blob);

		if (audioPlayer !== null) {
			audioPlayer.src = url;
			audioPlayer.loop = true;
		} else {
			console.error("Error generating noise:");
		}

		await SaveAudioToIndexDB(blob);

		if (buttonContainer !== null) {
			buttonContainer.innerHTML = playingSpinner;
		}
		audioPlayer.play().catch((err) => {
			console.warn("PlayBack failed: ", err);
			ShowGenerateButton();
		});
	} catch (err) {
		console.error("Error creating audio: ", err);
		ShowGenerateButton();
	}
};

const GenerateNoise = async (): Promise<void> => {
	ShowLoading();

	const sample_rate = 44100;
	const freq1 = 110;
	const freq2 = 220;
	const freq3 = 440;
	const duration = 60 * 25;
	const num_samples = sample_rate * duration;

	const rand_noise = Array.from({ length: sample_rate }, () => Math.random());
	const FadeAmt = (t: number) => {
		return t * t * t * (t * (t * 6 - 15) + 10);
	};

	const GradeAmt = (p: number): number => {
		const index = Math.floor(p) % rand_noise.length;
		return rand_noise[index] > 0.5 ? 1.0 : -1.0;
	};

	const NoiseVal = (p: number): number => {
		const p0 = Math.floor(p);
		const p1 = p0 + 1.0;
		const t = p - p0;
		const fade_t = FadeAmt(t);
		const g0 = GradeAmt(p0);
		const g1 = GradeAmt(p1);
		return (1.0 - fade_t) * g0 * (p - p0) + fade_t * g1 * (p - p1);
	};

	try {
		const audio_data = new Float32Array(num_samples);
		const chunk_size = sample_rate;
		let i = 0;
		const ProcessChunk = () => {
			const end = Math.min(i + sample_rate, num_samples);
			for (; i < end; i++) {
				const x1 = i / (sample_rate / freq1);
				const x2 = i / (sample_rate / freq2);
				const x3 = i / (sample_rate / freq3);

				const n1 = NoiseVal(x1);
				const n2 = NoiseVal(x2);
				const n3 = NoiseVal(x3);
				audio_data[i] = 0.5 * n1 + 0.3 * n2 + 0.2 * n3;
			}
			if (i < num_samples) {
				requestAnimationFrame(ProcessChunk);
			} else {
				FinishAudioGen(audio_data, sample_rate);
			}
		};
		ProcessChunk();
	} catch (err) {
		console.error("Error generating noise:", err);
		ShowGenerateButton();
	}
};

const IsSafari = (): boolean => {
	const ua = navigator.userAgent.toLowerCase();
	return (
		ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android")
	);
};

const SafariRotationFix = (): void => {
	if (audioContainer) {
		if (IsSafari()) {
			audioContainer.classList.remove("-rotate-10");
			audioContainer.classList.add("safari-audio-fix");
		}
	} else {
		console.log("Audio container not found, retrying...");
		setTimeout(SafariRotationFix, 100);
	}
};

document.addEventListener("DOMContentLoaded", SafariRotationFix);
window.addEventListener("load", LoadAudioFromStorage);
