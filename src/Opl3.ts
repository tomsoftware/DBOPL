
module Lemmings {

	/*
	public interface MixerChannel
	{
	 void AddSamples_m32(short samples, tangible.RefObject<Integer> buffer);
	 void AddSamples_s32(short samples, tangible.RefObject<Integer> buffer);
	}
	
	
	
	
	
	interface SynthHandler
	{
		Channel invoke(Chip chip, int samples, tangible.RefObject<Integer> output);
	}
	
	
	*/
	export enum SynthMode {
		sm2AM,
		sm2FM,
		sm3AM,
		sm3FM,
		sm4Start,
		sm3FMFM,
		sm3AMFM,
		sm3FMAM,
		sm3AMAM,
		sm6Start,
		sm2Percussion,
		sm3Percussion
	}

	//Shifts for the values contained in chandata variable
	export enum Shifts {
		SHIFT_KSLBASE = 16,
		SHIFT_KEYCODE = 24,
	};


	// Max buffer size.  Since only 512 samples can be generated at a time, setting
	// this to 512 * 2 channels means it'll be the largest it'll ever need to be.

	const BUFFER_SIZE_SAMPLES = 1024

	export class OPL {
		private dbopl: Handler = new Handler();
		private buffer: Int16Array;
		private mixer: MixerChannel;

		constructor(freq: number, channels: number) {

			this.buffer = new Int16Array(BUFFER_SIZE_SAMPLES * channels);
			this.mixer = new MixerChannel(this.buffer, channels);
			this.dbopl.Init(freq);
		}


		public write(reg:number, val:number) {
			this.dbopl.WriteReg(reg, val);
		}


		public getBuffer():Int16Array
		{
			return this.buffer;
		}

		public generate(lenSamples:number)
		{
			if (lenSamples > 512) {
				throw new Error('OPL.generate() cannot generate more than 512 samples per call');
			}
			if (lenSamples < 2) {
				throw new Error('OPL.generate() cannot generate fewer than 2 samples per call');
			}
			this.dbopl.Generate(this.mixer, lenSamples);

			return this.buffer;
		}
	}


}