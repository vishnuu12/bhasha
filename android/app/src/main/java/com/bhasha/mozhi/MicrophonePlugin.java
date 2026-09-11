package com.bhasha.mozhi;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "Microphone", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class MicrophonePlugin extends Plugin {
    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            permissionResult(call);
        } else {
            requestPermissionForAlias("microphone", call, "permissionResult");
        }
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("microphone") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Open Android Settings > Apps > Mozhi > Permissions manually.", error);
        }
    }
}
