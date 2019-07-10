
module Lemmings {

    let audioCtx = new AudioContext();
    let source = audioCtx.createBufferSource();
    let scriptNode = audioCtx.createScriptProcessor(8192, 2, 2);

    // When the buffer source stops playing, disconnect everything
    source.onended = () => {
        console.log('source.onended()');
        source.disconnect(scriptNode);
        scriptNode.disconnect(audioCtx.destination);
        scriptNode = null;
        source = null;
    }

    console.log('Sample rate', audioCtx.sampleRate);
    let mute = [], muteperc = 0;

    const imfdata = atob(`
AAAAAAAACwC4AAAAsQAAALMAAAC0AAAAtQAAALYAAAAyAgAAUiIAAHLyAACSEwAA8gAAADUCAABV
AQAAdfUAAJVDAAD1AAAAyA4AAKggAAC4LgAAIQIAAEEiAABh8gAAgRMAAOEAAAAkAgAARAEAAGT1
AACEQwAA5AAAAMEOAAChIAAAsSoAACgRAABIigAAaPEAAIgRAADoAAAAKwEAAEtBAABr8QAAi7MA
AOsAAADDAQAAoyAAALMuAAApEQAASYoAAGnxAACJEQAA6QAAACwBAABMQQAAbPEAAIyzAADsAAAA
xAEAAKQgAAC0KgAAKgUAAEpOAABq2gAAiiUAAOoAAAAtAQAATQEAAG35AACNFQAA7QAAAMUKAACl
MAAAtTcAADAyAABQRAAAcPgAAJD/AADwAAAAMxEAAFMBAABz9QAAk38AAPMAAADGDgAApjAAALYz
cACyAAAAthMAACIFAABCTgAAYtoAAIIlAADiAAAAJQEAAEUBAABl+QAAhRUAAOUAAADCCgAAojAA
ALIzAACmmAAAtjFwALUXAAC2EQAApSAAALU2AAC2MXAAshMAALYRAACiYwAAsjYAAKYwAAC2M3AA
tRYAAKWYAAC1NXAAshYAALYTAACiIAAAsjYAAKaYAAC2MXAAtRUAALU1cACyFgAAthEAAKIwAACy
NwAApjAAALYzcAC1FQAAtTVwALIXAAC2EwAAoiAAALI2AACmmAAAtjFwALUVAAC1NXAAshYAALYR
AACiYwAAsjYAALYxcAC1FQAAthEAALU1AACmMAAAtjNwALIWAACiIAAAsjZwALUVAAC2EwAAtTUA
AKaYAAC2MeAAuA4AALEKAACyFgAAsw4AALQKAAC2EQAAqGMAALguAAChYwAAsSoAAKLWAACyNgAA
o2MAALMuAACkYwAAtCoAAKbWAAC2MnAAtRUAALYSAAC1NQAApmsAALYxcACyFgAAthEAAKIgAACy
NgAAtjFwALUVAAC2EQAApWMAALU2AACm1gAAtjJwALIWAACimAAAsjVwALUWAAC2EgAApSAAALU2
AACmawAAtjFwALIVAACyNXAAtRYAALYRAACl1gAAtTYAAKbWAAC2MnAAshUAALI1cAC1FgAAthIA
AKUgAAC1NgAApmsAALYxcACyFQAAsjVwALUWAAC2EQAApWMAALU2AAC2MXAAshUAALYRAACyNQAA
ptYAALYycAC1FgAApSAAALU2cACyFQAAthIAALI1AACmawAAtjHUAA==`);

    const imf = new Uint8Array(imfdata.length);
    for (let i = 0; i < imfdata.length; i++) {
        imf[i] = imfdata.charCodeAt(i);
    }
    const samplesPerTick = Math.round(audioCtx.sampleRate / 560);

    console.log('Init WASM');


    let opl = new OPL(44100, 2);

    opl.write(0, 0);
    opl.write(0, 0);
    opl.generate(512);
    opl.generate(357);
    opl.write(184, 0);
    opl.write(177, 0);
    opl.write(179, 0);
    opl.write(180, 0);
    opl.write(181, 0);
    opl.write(182, 0);
    opl.write(50, 2);
    opl.write(82, 34);
    opl.write(114, 242);
    opl.write(146, 19);
    opl.write(242, 0);
    opl.write(53, 2);
    opl.write(85, 1);
    opl.write(117, 245);
    opl.write(149, 67);
    opl.write(245, 0);
    opl.write(200, 14);
    opl.write(168, 32);
    opl.write(184, 46);
    opl.write(33, 2);
    opl.write(65, 34);
    opl.write(97, 242);
    opl.write(129, 19);
    opl.write(225, 0);
    opl.write(36, 2);
    opl.write(68, 1);
    opl.write(100, 245);
    opl.write(132, 67);
    opl.write(228, 0);
    opl.write(193, 14);
    opl.write(161, 32);
    opl.write(177, 42);
    opl.write(40, 17);
    opl.write(72, 138);
    opl.write(104, 241);
    opl.write(136, 17);
    opl.write(232, 0);
    opl.write(43, 1);
    opl.write(75, 65);
    opl.write(107, 241);
    opl.write(139, 179);
    opl.write(235, 0);
    opl.write(195, 1);
    opl.write(163, 32);
    opl.write(179, 46);
    opl.write(41, 17);
    opl.write(73, 138);
    opl.write(105, 241);
    opl.write(137, 17);
    opl.write(233, 0);
    opl.write(44, 1);
    opl.write(76, 65);
    opl.write(108, 241);
    opl.write(140, 179);
    opl.write(236, 0);
    opl.write(196, 1);
    opl.write(164, 32);
    opl.write(180, 42);
    opl.write(42, 5);
    opl.write(74, 78);
    opl.write(106, 218);
    opl.write(138, 37);
    opl.write(234, 0);
    opl.write(45, 1);
    opl.write(77, 1);
    opl.write(109, 249);
    opl.write(141, 21);
    opl.write(237, 0);
    opl.write(197, 10);
    opl.write(165, 48);
    opl.write(181, 55);
    opl.write(48, 50);
    opl.write(80, 68);
    opl.write(112, 248);
    opl.write(144, 255);
    opl.write(240, 0);
    opl.write(51, 17);
    opl.write(83, 1);
    opl.write(115, 245);
    opl.write(147, 127);
    opl.write(243, 0);
    opl.write(198, 14);
    opl.write(166, 48);
    opl.write(182, 51);
    opl.generate(512);
 

    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(155);
    opl.generate(512);
    opl.generate(512);
    opl.generate(501);
    opl.write(178, 0);
    opl.write(182, 19);
    opl.write(34, 5);
    opl.write(66, 78);
    opl.write(98, 218);
    opl.write(130, 37);
    opl.write(226, 0);
    opl.write(37, 1);
    opl.write(69, 1);
    opl.write(101, 249);
    opl.write(133, 21);
    opl.write(229, 0);
    opl.write(194, 10);
    opl.write(162, 48);
    opl.write(178, 51);
    opl.write(166, 152);
    opl.write(182, 49);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(11);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(133);
    opl.write(181, 23);
    opl.write(182, 17);
    opl.write(165, 32);
    opl.write(181, 54);
    opl.write(182, 49);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);
    opl.generate(512);


    console.log('done!');





    //let opl = new OPL(audioCtx.sampleRate, 2);



    console.log('WASM init done');

    let p = 0;
    let lenGen = 0;
    scriptNode.onaudioprocess = audioProcessingEvent => {
        var b = audioProcessingEvent.outputBuffer;

        var c0 = b.getChannelData(0);
        var c1 = b.getChannelData(1);

        let lenFill = b.length;
        let posFill = 0;

        while (posFill < lenFill) {
            // Fill any leftover delay from the last buffer-fill event first
            while (lenGen > 0) {
                if (lenFill - posFill < 2) {
                    // No more space in buffer
                    return;
                }
                let lenNow = Math.max(2, Math.min(512, lenGen, lenFill - posFill));

                const samples = opl.generate(lenNow);

                //const samples = new Int16Array(s);
                for (let i = 0; i < lenNow; i++) {
                    c0[posFill] = samples[i * 2 + 0] / 32768.0;
                    c1[posFill] = samples[i * 2 + 1] / 32768.0;
                    posFill++;
                }
                lenGen -= lenNow;
            }

            let delay;
            do {
                // Read the song event
                const reg = imf[p + 0];
                let val = imf[p + 1];
                delay = imf[p + 2] | (imf[p + 3] << 8);

                // Force the 'note-on' bit off, if the channel is muted
                if ((reg & 0xF0) == 0xB0) {
                    if (reg == 0xBD) {
                        val &= ~muteperc;
                    } else if (mute[reg & 0x0F]) {
                        val &= ~0x20;
                    }
                }// else console.log(reg.toString(16), (reg & 0xF0).toString(16), (reg & 0xF0);
                opl.write(reg, val);

                // Advance to the next event in the song
                p += 4;
                if (p >= imf.length) {
                    console.log('Looping');
                    p = 0; // loop
                }
            } while (!delay);

            document.getElementById('progress').firstChild.nodeValue = Math.round(p / imf.length * 100) + '%';
            lenGen += delay * samplesPerTick;
        }
    };

    scriptNode.connect(audioCtx.destination);
    source.connect(scriptNode);
    source.start();
    audioCtx.suspend();
    console.log('Ready');



    document.getElementById('play').onclick = () => {
        audioCtx.resume();
        console.log('Play');
    };
    
    document.getElementById('pause').onclick = () => {
        audioCtx.suspend();
        console.log('Pause');
    };

    for (let i = 0; i < 9; i++) {
        mute[i] = false;
        const ct = document.getElementById('ch' + i);
        ct.className = 'play';
        ct.onclick = ev => {
            mute[i] = !mute[i];
            (ev.target as HTMLElement).className = mute[i] ? 'mute' : 'play';
        };
    }

    for (let i = 0; i < 5; i++) {
        const ct = document.getElementById('p' + i);
        ct.className = 'play';
        ct.onclick = ev => {
            muteperc ^= 1 << i;
            const muted = !!(muteperc & (1 << i));
            (ev.target as HTMLElement).className = muted ? 'mute' : 'play';
        };
    }
}