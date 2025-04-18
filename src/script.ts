//HTML
const loading_spinner = `<span class="icon-[svg-spinners--blocks-scale]"`;
const gen_button = `<button id="generateButton" class="btn btn-outline btn-success"`;

//Elements
const generateButton = document.getElementById("generateButton");
const audioPlayer = document.getElementById("audioPlayer");
const localStorageKey = "generatedNoise";
const buttonContainer = document.getElementById("buttonContainer");

const ShowLoading = (): void => {
	if (buttonContainer !== null) {
		buttonContainer.innerHTML = loading_spinner;
	} else {
		console.log("Button Container Missing");
	}
};

//! Todo
const finishAudioGen = (
	audio_data: Float32Array<ArrayBuffer>,
	sample_rate: number,
) => {};

const generateNoise = async (): Promise<void> => {
	ShowLoading();

	const sample_rate = 44100;
	const freq1 = 110;
	const freq2 = 220;
	const freq3 = 440;
	const duration = 60 * 25;
	const num_samples = sample_rate * duration;

	const rand_noise = Array.from({ length: sample_rate }, () => Math.random());
	const fadeAmt = (t: number) => {
		return t * t * t * (t * (t * 6 - 15) + 10);
	};

	const gradeAmt = (p: number): number => {
		const index = Math.floor(p) % rand_noise.length;
		return rand_noise[index] > 0.5 ? 1.0 : -1.0;
	};

	const noiseVal = (p: number): number => {
		const p0 = Math.floor(p);
		const p1 = p0 + 1.0;
		const t = p - p0;
		const fade_t = fadeAmt(t);
		const g0 = gradeAmt(p0);
		const g1 = gradeAmt(p1);
		return (1.0 - fade_t) * g0 * (p - p0) + fade_t * g1 * (p - p1);
	};

	try {
		const audio_data = new Float32Array(num_samples);
		const chunk_size = sample_rate;
		let i = 0;
		const processChunk = () => {
			const end = Math.min(i + sample_rate, num_samples);
			for (; i < end; i++) {
				const x1 = i / (sample_rate / freq1);
				const x2 = i / (sample_rate / freq2);
				const x3 = i / (sample_rate / freq3);

				const n1 = noiseVal(x1);
				const n2 = noiseVal(x2);
				const n3 = noiseVal(x3);
				audio_data[i] = 0.5 * n1 + 0.3 * n2 + 0.2 * n3;
			}
			if (i < num_samples) {
				requestAnimationFrame(processChunk);
			} else {
				finishAudioGen(audio_data, sample_rate);
			}
		};
		processChunk();
	} catch (err) {
		console.error("Error generating noise:", err);
		ShowGenerateButton();
	}
};

const ShowGenerateButton = (): void => {
	if (buttonContainer !== null && generateButton !== null) {
		buttonContainer.innerHTML = gen_button;
		generateButton.addEventListener("click", generateNoise);
	} else {
		console.log("Button Container/Button Missing");
	}
};
