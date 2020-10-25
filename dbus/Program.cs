using System;
using moonboard.DBus;
using System.Threading.Tasks;
using Tmds.DBus;
using System.Collections;
using System.Linq;

namespace dbustest
{
    class Program
    {
        static async Task Main(string[] args)
        {
                var systemConnection = Connection.System;
                var moonboard = systemConnection.CreateProxy<IMoonboard>(
                "com.moonboard",
                "/com/moonboard");

                var _rand = new Random();
                
                Console.WriteLine("Press CTRL+C to exit");
                do {
                    var ledLocations = Enumerable.Range(0, 10)
                    .Select(r => _rand.Next(400))
                    .ToList();
                    var problem = "{\"FEET\": [" + string.Join(",",ledLocations) + "]}";
                    Console.WriteLine($"Sending problem: {problem}. Press a key to send another.");
                    await moonboard.publish_problemAsync(problem).ConfigureAwait(true);
                    Console.ReadLine();
                } while (true);
        }
    }
}

