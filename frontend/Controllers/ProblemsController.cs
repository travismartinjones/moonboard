using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using frontend.ViewModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace frontend.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ProblemsController : ControllerBase
    {
        [HttpPost]
        [Route("search")]
        public IEnumerable<Problem> Search()
        {
            return new List<Problem>();
        }

        [HttpPost]
        public Guid Add(Problem problem)
        {
            problem.Id = Guid.NewGuid();

            return problem.Id;
        }

        [HttpGet]
        [Route("{id}")]
        public Problem Get(Guid id)
        {
            return null;
        }

        [HttpPut]
        public void Update(Problem problem)
        {
            
        }
    }
}
