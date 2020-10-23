using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Tmds.DBus;

[assembly: InternalsVisibleTo(Tmds.DBus.Connection.DynamicAssemblyName)]
namespace moonboard.DBus
{
    [DBusInterface("com.moonboard")]
    interface IMoonboard : IDBusObject
    {
        Task publish_problemAsync(object Problem);
        Task<IDisposable> Watchnew_problemAsync(Action<string> handler, Action<Exception> onError = null);
    }

    [DBusInterface("org.freedesktop.DBus.ObjectManager")]
    interface IObjectManager : IDBusObject
    {
        Task<IDictionary<ObjectPath, IDictionary<string, IDictionary<string, object>>>> GetManagedObjectsAsync();
    }

    [DBusInterface("org.bluez.GattCharacteristic1")]
    interface IGattCharacteristic1 : IDBusObject
    {
        Task<byte[]> ReadValueAsync(IDictionary<string, object> Options);
        Task WriteValueAsync(byte[] Value, IDictionary<string, object> Options);
        Task StartNotifyAsync();
        Task StopNotifyAsync();
    }
}