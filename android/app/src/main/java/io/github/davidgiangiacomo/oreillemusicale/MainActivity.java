package io.github.davidgiangiacomo.oreillemusicale;

import android.media.AudioManager;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Les touches de volume règlent le volume des médias (celui des exercices),
        // et non celui de la sonnerie.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
    }
}
