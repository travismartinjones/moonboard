using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using moonboard.DBus;
using Tmds.DBus;
using System.Collections;
using System.Linq;
using frontend.ViewModels;
using Newtonsoft.Json;

namespace frontend.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class LedsController : ControllerBase
    {
        // single instance per app
        static IMoonboard moonboard = null;

        public LedsController()
        {
            if (moonboard != null) return;
            moonboard = Connection.System.CreateProxy<IMoonboard>(
            "com.moonboard",
            "/com/moonboard");
        }
        
        [HttpPut]
        public async Task Put(Route route)
        {
            await moonboard.publish_problemAsync(JsonConvert.SerializeObject(route)).ConfigureAwait(true);
        }
    }
}
