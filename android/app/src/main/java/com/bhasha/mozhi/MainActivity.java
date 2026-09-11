package com.bhasha.mozhi;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MicrophonePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
