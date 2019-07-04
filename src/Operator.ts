module Lemmings {

    enum Operator20Masks {
        MASK_KSR = 0x10,
        MASK_SUSTAIN = 0x20,
        MASK_VIBRATO = 0x40,
        MASK_TREMOLO = 0x80

    }

    enum State {
        OFF,
        RELEASE,
        SUSTAIN,
        DECAY,
        ATTACK,
    }

    export class Operator {

        /// todo: delete me
        public OperatorIndex:number;

        //public volHandler: VolumeHandler;


        public waveBase: number;// Int16Array; /** s16*  */
        public waveMask: number; /** u32 */
        public waveStart: number; /** u32 */

        public waveIndex: number; /**u32 */ // WAVE_signed long shifted counter of the frequency index
        public waveAdd: number; /**u32 */  	//The base frequency without vibrato
        public waveCurrent: number; /**u32 */  //waveAdd + vibratao

        public chanData: number; /**u32 *///Frequency/octave and derived data coming from whatever channel controls this
        public freqMul: number; /**u32 *///Scale channel frequency with this, TODO maybe remove?
        public vibrato: number; /**u32 */ 	//Scaled up vibrato strength
        public sustainLevel: number; /** s32*/ //When stopping at sustain level stop here
        public totalLevel: number; /** s32*/ //totalLevel is added to every generated volume
        public currentLevel: number; /**u32 */ //totalLevel + tremolo
        public volume: number; /**s32 *///The currently active volume

        public attackAdd: number; /** u32 */ //Timers for the different states of the envelope
        public decayAdd: number; /** u32 */
        public releaseAdd: number; /**u32  */
        public rateIndex: number; /** u32 */ //Current position of the evenlope

        public rateZero: number; /** u8 */ 	//signed long for the different states of the envelope having no changes
        public keyOn: number; /** u8 */ //Bitmask of different values that can generate keyon

        //Registers, also used to check for changes
        public reg20: number; /** u8 */
        public reg40: number; /** u8 */
        public reg60: number; /** u8 */
        public reg80: number; /** u8 */
        public regE0: number; /** u8 */

        //Active part of the envelope we're in
        public state: number; /** u8 */
        //0xff when tremolo is enabled
        public tremoloMask: number; /** u8 */
        //Strength of the vibrato
        public vibStrength: number; /** u8 */
        //Keep track of the calculated KSR so we can check for changes
        public ksr; /** u8 */


        private SetState(s: State /**u8  */): void {
            this.state = s;
            //this.volHandler = GlobalMembers.VolumeHandlerTable[s];
        }

        //We zero out when rate == 0
        private UpdateAttack(chip: Chip): void {
            let rate = this.reg60 >>> 4; /** Bit8u */
            if (rate != 0) {
                let val = ((rate << 2) + this.ksr) | 0; /** Bit8u */;
                this.attackAdd = chip.attackRates[val];
                this.rateZero &= ~(1 << State.ATTACK);
            }
            else {
                this.attackAdd = 0;
                this.rateZero |= (1 << State.ATTACK);
            }
        }

        private UpdateRelease(chip: Chip): void {
            let rate = (this.reg80 & 0xf);
            if (rate != 0) {
                let val = ((rate << 2) + this.ksr) | 0;
                this.releaseAdd = chip.linearRates[val];
                this.rateZero &= ~(1 << State.RELEASE);
                if ((this.reg20 & Operator20Masks.MASK_SUSTAIN) == 0) {
                    this.rateZero &= ~(1 << State.SUSTAIN);
                }
            }
            else {
                this.rateZero |= (1 << State.RELEASE);
                this.releaseAdd = 0;
                if ((this.reg20 & Operator20Masks.MASK_SUSTAIN) == 0) {
                    this.rateZero |= (1 << State.SUSTAIN);
                }
            }
        }

        private UpdateDecay(chip: Chip): void {
            let rate = (this.reg60 & 0xf);
            if (rate != 0) {
                let val = ((rate << 2) + this.ksr) | 0;
                this.decayAdd = chip.linearRates[val];
                this.rateZero &= ~(1 << State.DECAY);
            }
            else {
                this.decayAdd = 0;
                this.rateZero |= (1 << State.DECAY);
            }
        }

        public UpdateAttenuation(): void {
            let kslBase = ((this.chanData >>> Shifts.SHIFT_KSLBASE) & 0xff);
            let tl = this.reg40 & 0x3f;

            let kslShift = GlobalMembers.KslShiftTable[this.reg40 >>> 6];
            //Make sure the attenuation goes to the right bits
            this.totalLevel = tl << ((9) - 7);
            this.totalLevel += (kslBase << ((9) - 9)) >> kslShift;
        }

        public UpdateRates(chip: Chip): void {
            //Mame seems to reverse this where enabling ksr actually lowers
            //the rate, but pdf manuals says otherwise?

            let newKsr = ((this.chanData >>> Shifts.SHIFT_KEYCODE) & 0xff);
            if ((this.reg20 & Operator20Masks.MASK_KSR) == 0) {
                newKsr >>>= 2;
            }
            if (this.ksr == newKsr) {
                return;
            }
            this.ksr = newKsr;
            this.UpdateAttack(chip);
            this.UpdateDecay(chip);
            this.UpdateRelease(chip);
        }

        public UpdateFrequency(): void {
            let freq = this.chanData & ((1 << 10) - 1) | 0;
            let block = (this.chanData >>> 10) & 0xff;


            this.waveAdd = ((freq << block) * this.freqMul) | 0;

            if ((this.reg20 & Operator20Masks.MASK_VIBRATO) != 0) {

                this.vibStrength = (freq >>> 7) & 0xFF;

                this.vibrato = ((this.vibStrength << block) * this.freqMul) | 0;

            }
            else {
                this.vibStrength = 0;
                this.vibrato = 0;
            }
        }

        public Write20(chip: Chip, val: number /** u8 */): void {
            let change = (this.reg20 ^ val);
            if (change == 0) {
                return;
            }
            this.reg20 = val;
            //Shift the tremolo bit over the entire register, saved a branch, YES!
            this.tremoloMask = ((val) >> 7) & 0xFF;
            this.tremoloMask &= ~((1 << ((9) - 9)) - 1);
            //Update specific features based on changes
            if ((change & Operator20Masks.MASK_KSR) != 0) {
                this.UpdateRates(chip);
            }
            //With sustain enable the volume doesn't change
            if ((this.reg20 & Operator20Masks.MASK_SUSTAIN) != 0 || (this.releaseAdd == 0)) {
                this.rateZero |= (1 << State.SUSTAIN);
            }
            else {
                this.rateZero &= ~(1 << State.SUSTAIN);
            }
            //Frequency multiplier or vibrato changed
            if ((change & (0xf | Operator20Masks.MASK_VIBRATO)) != 0) {
                this.freqMul = chip.freqMul[val & 0xf];
                this.UpdateFrequency();
            }
        }

        public Write40(chip: Chip, val: number /** u8 */): void {
            if ((this.reg40 ^ val) == 0) {
                return;
            }
            this.reg40 = val;
            this.UpdateAttenuation();
        }

        public Write60(chip: Chip, val: number /** u8 */): void {
            let change = (this.reg60 ^ val);
            this.reg60 = val;
            if ((change & 0x0f) != 0) {
                this.UpdateDecay(chip);
            }
            if ((change & 0xf0) != 0) {
                this.UpdateAttack(chip);
            }
        }

        public Write80(chip: Chip, val: number /** u8 */): void {
            let change = (this.reg80 ^ val);
            if (change == 0) {
                return;
            }
            this.reg80 = val;

            let sustain = (val >>> 4);
            //Turn 0xf into 0x1f
            sustain |= (sustain + 1) & 0x10;
            this.sustainLevel = sustain << ((9) - 5);
            if ((change & 0x0f) != 0) {
                this.UpdateRelease(chip);
            }
        }

        public WriteE0(chip: Chip, val: number /** u8 */): void {
            if ((this.regE0 ^ val) == 0) {
                return;
            }
            //in opl3 mode you can always selet 7 waveforms regardless of waveformselect
            let waveForm = (val & ((0x3 & chip.waveFormMask) | (0x7 & chip.opl3Active)));
            this.regE0 = val;



            //this.waveBase = GlobalMembers.WaveTable + GlobalMembers.WaveBaseTable[waveForm];
            this.waveBase = GlobalMembers.WaveBaseTable[waveForm];
            this.waveStart = GlobalMembers.WaveStartTable[waveForm] << (32 - 10);
            this.waveMask = GlobalMembers.WaveMaskTable[waveForm];

        }


        public Silent(): boolean {

            if (!((this.totalLevel + this.volume) >= ((12 * 256) >> (3 - ((9) - 9))))) {
                return false;
            }
            if ((this.rateZero & (1 << this.state)) == 0) {
                return false;
            }
            return true;
        }

        public Prepare(chip: Chip) {
            this.currentLevel = this.totalLevel + (chip.tremoloValue & this.tremoloMask);
            this.waveCurrent = this.waveAdd;

            if ((this.vibStrength >>> chip.vibratoShift) != 0) {

                let add = this.vibrato >>> chip.vibratoShift;
                //Sign extend over the shift value
                let neg = chip.vibratoSign;
                //Negate the add with -1 or 0
                add = ((add ^ neg) - neg);
                this.waveCurrent += add;
            }
        }

        public KeyOn(mask: number /** u8 */) {
            if (this.keyOn == 0) {
                //Restart the frequency generator

                this.waveIndex = this.waveStart;



                this.rateIndex = 0;
                this.SetState(State.ATTACK);
            }
            this.keyOn |= mask;
        }

        public KeyOff(mask: number /** u8 */) {
            this.keyOn &= ~mask;
            if (this.keyOn == 0) {
                if (this.state != State.OFF) {
                    this.SetState(State.RELEASE);
                }
            }
        }


        // public TemplateVolume(yes:State):number {
        public TemplateVolume(): number {
            var yes = this.state;
            let vol = this.volume;
            let change;

            switch (yes) {
                case State.OFF:
                    return (511 << ((9) - 9));
                case State.ATTACK:
                    change = this.RateForward(this.attackAdd);
                    if (change == 0) {
                        return vol;
                    }

                    vol += ((~vol) * change) >> 3;
                    if (vol < 0) {
                        this.volume = 0;
                        this.rateIndex = 0;
                        this.SetState(State.DECAY);
                        return 0;
                    }
                    break;
                case State.DECAY:
                    vol += this.RateForward(this.decayAdd);
                    if ((vol >= this.sustainLevel)) {
                        //Check if we didn't overshoot max attenuation, then just go off
                        if ((vol >= (511 << ((9) - 9)))) {
                            this.volume = (511 << ((9) - 9));
                            this.SetState(State.OFF);
                            return (511 << ((9) - 9));
                        }
                        //Continue as sustain
                        this.rateIndex = 0;
                        this.SetState(State.SUSTAIN);
                    }
                    break;
                case State.SUSTAIN:
                    if ((this.reg20 & Operator20Masks.MASK_SUSTAIN) != 0) {
                        return vol;
                    }
                //In sustain phase, but not sustaining, do regular release
                case State.RELEASE:
                    vol += this.RateForward(this.releaseAdd);
                    if ((vol >= (511 << ((9) - 9)))) {
                        this.volume = (511 << ((9) - 9));
                        this.SetState(State.OFF);
                        return (511 << ((9) - 9));
                    }
                    break;
            }
            this.volume = vol;
            return vol | 0;
        }

        public RateForward(add: number /* u32 */): number /** s32 */ {
            this.rateIndex += add | 0;

            let ret = this.rateIndex >>> 24;
            this.rateIndex = this.rateIndex & ((1 << 24) - 1);
            return ret;
        }

        public ForwardWave(): number /* unsigned long  */ {
            this.waveIndex += this.waveCurrent;

            return (this.waveIndex >>> (32 - 10));
        }

        public ForwardVolume(): number /** 	unsigned long */ {
            return this.currentLevel + this.TemplateVolume();
        }

        public GetSample(modulation: number /** Bits */): number /** Bits  */ {
            let vol = this.ForwardVolume();

            if (((vol) >= ((12 * 256) >> (3 - ((9) - 9))))) {
                //Simply forward the wave
                this.waveIndex += this.waveCurrent;
                return 0;
            }
            else {
                let index = this.ForwardWave();
                index += modulation;
                return this.GetWave(index, vol);
            }
        }


        public GetWave(index: number /** Bitu */, vol: number /** Bitu */): number /** Bits */ {

            //return ((this.waveBase[index & this.waveMask] * GlobalMembers.MulTable[vol >>> ((9) - 9)]) >> 16);
            return ((GlobalMembers.WaveTable[this.waveBase + (index & this.waveMask)] * GlobalMembers.MulTable[vol >>> ((9) - 9)]) >> 16);
        }

        public constructor() {
            this.chanData = 0 | 0;
            this.freqMul = 0 | 0;
            this.waveIndex = 0 | 0;
            this.waveAdd = 0 | 0;
            this.waveCurrent = 0 | 0;
            this.keyOn = 0 | 0;
            this.ksr = 0 | 0;
            this.reg20 = 0 | 0;
            this.reg40 = 0 | 0;
            this.reg60 = 0 | 0;
            this.reg80 = 0 | 0;
            this.regE0 = 0 | 0;
            this.SetState(State.OFF);
            this.rateZero = (1 << State.OFF);
            this.sustainLevel = (511 << ((9) - 9));
            this.currentLevel = (511 << ((9) - 9));
            this.totalLevel = (511 << ((9) - 9));
            this.volume = (511 << ((9) - 9));
            this.releaseAdd = 0;
        }
    }




}