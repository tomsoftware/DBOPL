module Lemmings {

    export class Chip {
        //This is used as the base counter for vibrato and tremolo
        public lfoCounter: number; //Bit32u
        public lfoAdd: number; //Bit32u


        public noiseCounter: number; //Bit32u
        public noiseAdd: number; //Bit32u
        public noiseValue: number; //Bit32u

        /// Frequency scales for the different multiplications
        public freqMul: Uint32Array = new Uint32Array(16) //Bit32u[16];
        /// Rates for decay and release for rate of this chip
        public linearRates: Int32Array = new Int32Array(76); //new int[76];
        /// Best match attack rates for the rate of this chip
        public attackRates: Int32Array = new Int32Array(76); //new int[76];

        /// 18 channels with 2 operators each
        public chan: Channel[];

        public reg104: number; //Bit8u
        public reg08: number; //Bit8u
        public reg04: number; //Bit8u
        public regBD: number; //Bit8u
        public vibratoIndex: number; //Bit8u
        public tremoloIndex: number; //Bit8u
        public vibratoSign: number; //Bit8s
        public vibratoShift: number; //Bit8u
        public tremoloValue: number; //Bit8u
        public vibratoStrength: number; //Bit8u
        public tremoloStrength: number; //Bit8u
        /// Mask for allowed wave forms
        public waveFormMask: number; //Bit8u
        //0 or -1 when enabled
        public opl3Active: number; //Bit8s


        public ForwardLFO(samples: number /* Bit32u */): number /* Bit32u */ {

            //Current vibrato value, runs 4x slower than tremolo
            this.vibratoSign = (GlobalMembers.VibratoTable[this.vibratoIndex >>> 2]) >> 7;
            this.vibratoShift = ((GlobalMembers.VibratoTable[this.vibratoIndex >>> 2] & 7) + this.vibratoStrength) | 0;
            this.tremoloValue = (GlobalMembers.TremoloTable[this.tremoloIndex] >>> this.tremoloStrength) | 0;

            //Check hom many samples there can be done before the value changes
            let todo = ((256 << (((32 - 10) - 10))) - this.lfoCounter) | 0;
            let count = (todo + this.lfoAdd - 1) / this.lfoAdd | 0;

            if (count > samples) {
                count = samples;
                this.lfoCounter += count * this.lfoAdd | 0;
            }
            else {
                this.lfoCounter += count * this.lfoAdd | 0;
                this.lfoCounter &= ((256 << (((32 - 10) - 10))) - 1);
                //Maximum of 7 vibrato value * 4
                this.vibratoIndex = (this.vibratoIndex + 1) & 31;
                //Clip tremolo to the the table size
                if (this.tremoloIndex + 1 < GlobalMembers.TREMOLO_TABLE) {
                    ++this.tremoloIndex;
                }
                else {
                    this.tremoloIndex = 0;
                }
            }
            return count;
        }

        public ForwardNoise(): number /* Bit32u */ {
            this.noiseCounter += this.noiseAdd;

            let count = (this.noiseCounter >>> ((32 - 10) - 10)) | 0;
            this.noiseCounter &= ((1 << (32 - 10)) - 1) | 0;
            for (; count > 0; --count) {
                //Noise calculation from mame
                this.noiseValue ^= (0x800302) & (0 - (this.noiseValue & 1));

                this.noiseValue >>>= 1;
            }
            return this.noiseValue;
        }

        public WriteBD(val: number /* Bit8u */): void {
            let change = this.regBD ^ val;
            if (change == 0) {
                return;
            }
            this.regBD = val | 0;
            /// TODO could do this with shift and xor?
            this.vibratoStrength = ((val & 0x40) != 0 ? 0x00 : 0x01);
            this.tremoloStrength = ((val & 0x80) != 0 ? 0x00 : 0x02);
            if ((val & 0x20) != 0) {
                //Drum was just enabled, make sure channel 6 has the right synth
                if ((change & 0x20) != 0) {
                    if (this.opl3Active) {
                        //this.chan[6].synthHandler = & Channel.BlockTemplate < SynthMode.sm3Percussion >;
                        this.chan[6].synthMode = SynthMode.sm3Percussion;
                    }
                    else {
                        //this.chan[6].synthHandler = & Channel.BlockTemplate < SynthMode.sm2Percussion >;
                        this.chan[6].synthMode = SynthMode.sm2Percussion;
                    }
                }
                //Bass Drum
                if ((val & 0x10) != 0) {
                    this.chan[6].Op(0).KeyOn(0x2);
                    this.chan[6].Op(1).KeyOn(0x2);
                }
                else {
                    this.chan[6].Op(0).KeyOff(0x2);
                    this.chan[6].Op(1).KeyOff(0x2);
                }
                //Hi-Hat
                if ((val & 0x1) != 0) {
                    this.chan[7].Op(0).KeyOn(0x2);
                }
                else {
                    this.chan[7].Op(0).KeyOff(0x2);
                }
                //Snare
                if ((val & 0x8) != 0) {
                    this.chan[7].Op(1).KeyOn(0x2);
                }
                else {
                    this.chan[7].Op(1).KeyOff(0x2);
                }
                //Tom-Tom
                if ((val & 0x4) != 0) {
                    this.chan[8].Op(0).KeyOn(0x2);
                }
                else {
                    this.chan[8].Op(0).KeyOff(0x2);
                }
                //Top Cymbal
                if ((val & 0x2) != 0) {
                    this.chan[8].Op(1).KeyOn(0x2);
                }
                else {
                    this.chan[8].Op(1).KeyOff(0x2);
                }

            }
            //Toggle keyoffs when we turn off the percussion
            else if (change & 0x20) {
                //Trigger a reset to setup the original synth handler
                this.chan[6].ResetC0(this);
                this.chan[6].Op(0).KeyOff(0x2);
                this.chan[6].Op(1).KeyOff(0x2);
                this.chan[7].Op(0).KeyOff(0x2);
                this.chan[7].Op(1).KeyOff(0x2);
                this.chan[8].Op(0).KeyOff(0x2);
                this.chan[8].Op(1).KeyOff(0x2);
            }
        }

        public WriteReg(reg: number /* int */, val: number /** byte */): void {
            let index = 0;

            switch ((reg & 0xf0) >>> 4) {

                case 0x00 >> 4:
                    if (reg == 0x01) {
                        this.waveFormMask = ((val & 0x20) != 0 ? 0x7 : 0x0);
                    }
                    else if (reg == 0x104) {

                        if (((this.reg104 ^ val) & 0x3f) == 0) {
                            return;
                        }

                        this.reg104 = (0x80 | (val & 0x3f));
                    }
                    else if (reg == 0x105) {

                        if (((this.opl3Active ^ val) & 1) == 0) {
                            return;
                        }
                        this.opl3Active = (val & 1) != 0 ? 0xff : 0;

                        for (let i = 0; i < 18; i++) {
                            this.chan[i].ResetC0(this);
                        }
                    }
                    else if (reg == 0x08) {
                        this.reg08 = val;
                    }

                case 0x10 >> 4:
                    break;

                case 0x20 >> 4:

                case 0x30 >> 4:

                    index = (((reg >>> 3) & 0x20) | (reg & 0x1f));
                    if (GlobalMembers.OpOffsetTable[index] != 0) {
                        let  regOp:Operator = this.chan[0].Op(GlobalMembers.OpOffsetTable[index]);
                        //let  regOp:Operator = (Operator)(((String)this) + GlobalMembers.OpOffsetTable[index]);
                        regOp.Write20(this, val);
                    };
                    break;

                case 0x40 >> 4:

                case 0x50 >> 4:

                    index = (((reg >>> 3) & 0x20) | (reg & 0x1f));
                    if (GlobalMembers.OpOffsetTable[index] != 0) {
                        let  regOp:Operator = this.chan[0].Op(GlobalMembers.OpOffsetTable[index]);
                        //let regOp:Operator = (Operator)(((String)this) + GlobalMembers.OpOffsetTable[index]);
                        regOp.Write40(this, val);
                    };
                    break;

                case 0x60 >> 4:

                case 0x70 >> 4:

                    index = (((reg >>> 3) & 0x20) | (reg & 0x1f));
                    if (GlobalMembers.OpOffsetTable[index] != 0) {
                        let  regOp:Operator = this.chan[0].Op(GlobalMembers.OpOffsetTable[index]);
                        //let regOp:Operator = (Operator)(((String)this) + GlobalMembers.OpOffsetTable[index]);
                        regOp.Write60(this, val);
                    };
                    break;

                case 0x80 >> 4:

                case 0x90 >> 4:

                    index = (((reg >>> 3) & 0x20) | (reg & 0x1f));
                    if (GlobalMembers.OpOffsetTable[index] != 0) {
                        let  regOp:Operator = this.chan[0].Op(GlobalMembers.OpOffsetTable[index]);
                        //let regOp:Operator = (Operator)(((String)this) + GlobalMembers.OpOffsetTable[index]);
                        regOp.Write80(this, val);
                    };
                    break;

                case 0xa0 >> 4:

                    index = (((reg >>> 4) & 0x10) | (reg & 0xf));
                    if (GlobalMembers.ChanOffsetTable[index] != 0) {
                        let regChan:Channel = this.chan[GlobalMembers.ChanOffsetTable[index]];
                       //let regChan:Channel = (Channel)(((String)this) + GlobalMembers.ChanOffsetTable[index]);
                        regChan.WriteA0(this, val);
                    };
                    break;

                case 0xb0 >> 4:
                    if (reg == 0xbd) {
                        this.WriteBD(val);
                    }
                    else {

                        index = (((reg >>> 4) & 0x10) | (reg & 0xf));
                        if (GlobalMembers.ChanOffsetTable[index] != 0) {
                            let regChan:Channel = this.chan[GlobalMembers.ChanOffsetTable[index]];
                            //let regChan:Channel = (Channel)(((String)this) + GlobalMembers.ChanOffsetTable[index]);
                            regChan.WriteB0(this, val);
                        };
                    }
                    break;

                case 0xc0 >> 4:

                    index = (((reg >>> 4) & 0x10) | (reg & 0xf));
                    if (GlobalMembers.ChanOffsetTable[index] != 0) {
                        let regChan:Channel = this.chan[GlobalMembers.ChanOffsetTable[index]];
                        //let regChan:Channel = (Channel)(((String)this) + GlobalMembers.ChanOffsetTable[index]);
                        regChan.WriteC0(this, val);
                    };

                case 0xd0 >> 4:
                    break;
                case 0xe0 >> 4:
                case 0xf0 >> 4:
                    index = (((reg >>> 3) & 0x20) | (reg & 0x1f));
                    if (GlobalMembers.OpOffsetTable[index] != 0) {
                        let  regOp:Operator = this.chan[0].Op(GlobalMembers.OpOffsetTable[index]);
                        //let regOp:Operator = (Operator)(((String)this) + GlobalMembers.OpOffsetTable[index]);
                        regOp.WriteE0(this, val);
                    };
                    break;
            }
        }

        public WriteAddr(port: number /* Bit32u */, val:number /* byte */): number/* Bit8u */ {
            switch (port & 3) {
                case 0:
                    return val;
                case 2:
                    if (this.opl3Active || (val == 0x05)) {
                        return 0x100 | val;
                    }
                    else {
                        return val;
                    }
            }
            return 0;
        }

        public GenerateBlock2(total: number /* Bitu */, output: Int32Array /*  Bit32s* */): void {
            let outputIndex = 0;

            while (total > 0) {
                let samples = this.ForwardLFO(total);

                //todo ?? do we need this
                output.fill(0, outputIndex, outputIndex + samples);

                for (let count = 0; count < 9; count++) {
                    this.chan[count].synthHandler(this, samples, output);
                }

                total -= samples;
                outputIndex += samples;
            }
        }


        public GenerateBlock3(total: number /* Bitu */, output: Int32Array /* Bit32s* */): void {
            let outputIndex = 0;
            
            while (total > 0) {
                let samples = this.ForwardLFO(total); /** Bit32u */

                output.fill(0, outputIndex, outputIndex + samples * 2);

                //int count = 0;
                for (let c = 0; c < 18; c++) {
                    //count++;
                    this.chan[c].synthHandler(this, samples, output);
                }
                total -= samples;
                outputIndex += samples * 2;
            }
        }


        public Setup(rate: number /* Bit32u */): void {
            let scale = GlobalMembers.OPLRATE / rate;

            //Noise counter is run at the same precision as general waves
            this.noiseAdd = (0.5 + scale * (1 << ((32 - 10) - 10))) | 0;
            this.noiseCounter = 0 | 0;
            this.noiseValue = 1 | 0;//Make sure it triggers the noise xor the first time
            //The low frequency oscillation counter
            //Every time his overflows vibrato and tremoloindex are increased

            this.lfoAdd = (0.5 + scale * (1 << ((32 - 10) - 10))) | 0;
            this.lfoCounter = 0 | 0;
            this.vibratoIndex = 0 | 0;
            this.tremoloIndex = 0 | 0;

            //With higher octave this gets shifted up
            //-1 since the freqCreateTable = *2
            let freqScale = (0.5 + scale * (1 << ((32 - 10) - 1 - 10))) | 0;
            for (let i = 0; i < 16; i++) {
                this.freqMul[i] = (freqScale * GlobalMembers.FreqCreateTable[i]) | 0;
            }

            //-3 since the real envelope takes 8 steps to reach the single value we supply
            for (let i = 0; i < 76; i++) {

                let index = GlobalMembers.EnvelopeSelectIndex(i);
                let shift = GlobalMembers.EnvelopeSelectShift(i);

                this.linearRates[i] = (scale * (GlobalMembers.EnvelopeIncreaseTable[index] << (24 + ((9) - 9) - shift - 3))) | 0;
            }

            //Generate the best matching attack rate
            for (let i = 0; i < 62; i++) {

                let index = GlobalMembers.EnvelopeSelectIndex(i);
                let shift = GlobalMembers.EnvelopeSelectShift(i);

                //Original amount of samples the attack would take
                let original = ((GlobalMembers.AttackSamplesTable[index] << shift) / scale) | 0;

                let guessAdd = (scale * (GlobalMembers.EnvelopeIncreaseTable[index] << (24 - shift - 3))) | 0;
                let bestAdd = guessAdd;
                let bestDiff = 1 << 30;
                for (let passes = 0; passes < 16; passes++) {
                    let volume = (511 << ((9) - 9));
                    let samples = 0;
                    let count = 0;

                    while (volume > 0 && samples < original * 2) {
                        count += guessAdd;

                        let change = count >>> 24;
                        count &= ((1 << 24) - 1);
                        if ((change) != 0) { // less than 1 % 
                            volume += (~volume * change) >> 3;
                        }
                        samples++;

                    }
                    let diff = original - samples;
                    let lDiff = Math.abs(diff) | 0;
                    //Init last on first pass
                    if (lDiff < bestDiff) {
                        bestDiff = lDiff;
                        bestAdd = guessAdd;
                        if (bestDiff == 0) {
                            break;
                        }
                    }
                    //Below our target
                    if (diff < 0) {
                        //Better than the last time
                        let mul = (((original - diff) << 12) / original) | 0;

                        guessAdd = ((guessAdd * mul) >> 12);
                        guessAdd++;
                    }
                    else if (diff > 0) {
                        let mul = (((original - diff) << 12) / original) | 0;

                        guessAdd = (guessAdd * mul) >> 12;
                        guessAdd--;
                    }
                }
                this.attackRates[i] = bestAdd;
            }
            for (let i = 62; i < 76; i++) {
                //This should provide instant volume maximizing
                this.attackRates[i] = 8 << 24;
            }

            //Setup the channels with the correct four op flags
            //Channels are accessed through a table so they appear linear here
            this.chan[0].fourMask = (0x00 | (1 << 0));
            this.chan[1].fourMask = (0x80 | (1 << 0));
            this.chan[2].fourMask = (0x00 | (1 << 1));
            this.chan[3].fourMask = (0x80 | (1 << 1));
            this.chan[4].fourMask = (0x00 | (1 << 2));
            this.chan[5].fourMask = (0x80 | (1 << 2));

            this.chan[9].fourMask = (0x00 | (1 << 3));
            this.chan[10].fourMask = (0x80 | (1 << 3));
            this.chan[11].fourMask = (0x00 | (1 << 4));
            this.chan[12].fourMask = (0x80 | (1 << 4));
            this.chan[13].fourMask = (0x00 | (1 << 5));
            this.chan[14].fourMask = (0x80 | (1 << 5));

            //mark the percussion channels
            this.chan[6].fourMask = 0x40;
            this.chan[7].fourMask = 0x40;
            this.chan[8].fourMask = 0x40;

            //Clear Everything in opl3 mode
            this.WriteReg(0x105, 0x1);
            for (let i = 0; i < 512; i++) {
                if (i == 0x105) {
                    continue;
                }
                this.WriteReg(i, 0xff);
                this.WriteReg(i, 0x0);
            }
            this.WriteReg(0x105, 0x0);
            //Clear everything in opl2 mode
            for (let i = 0; i < 255; i++) {
                this.WriteReg(i, 0xff);
                this.WriteReg(i, 0x0);
            }
        }

        public constructor() {
            this.reg08 = 0;
            this.reg04 = 0;
            this.regBD = 0;
            this.reg104 = 0;
            this.opl3Active = 0;

            const ChannelCount = 18;
            this.chan = new Array(ChannelCount); // new Channel[18];
            let op = new Array(2 * ChannelCount); // new Operator[18 * 2]

            for (let i = 0; i < op.length; i++) {
                op[i] = new Operator();
            }

            for (let i = 0; i < ChannelCount; i++) {
                this.chan[i] = new Channel(this.chan, i, op, i * 2);
            }
        }
    }

}