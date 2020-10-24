using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using moonboard.DBus;
using Tmds.DBus;
using System.Collections;
using System.Linq;

namespace frontend.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class LedController : ControllerBase
    {
        
        [HttpPost]
        public async Task Post(dynamic problem)
        {
            var systemConnection = Connection.System;
            var moonboard = systemConnection.CreateProxy<IMoonboard>(
            "com.moonboard",
            "/com/moonboard");
            await moonboard.publish_problemAsync(problem).ConfigureAwait(true);
        }
    }
}
