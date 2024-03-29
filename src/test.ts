/// example code used from : 
//////  https://github.com/Malvineous/opljs


module example {

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


    let opl = new DBOPL.OPL(audioCtx.sampleRate, 2);



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