# Disconnected editing

People may keep editing while the network is unavailable. Changes are written
to the local journal and remain visible on the device. After connectivity
returns, the client exchanges journal entries, detects concurrent changes, and
asks the person to resolve any conflicting versions before synchronization.
