using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using frontend.ViewModels;
using LiteDB;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace frontend.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class ProblemsController : ControllerBase
    {
        const string DatabaseFilename = "systemboard.db";

        [HttpPost]
        [Route("search")]
        public IEnumerable<Problem> Search()
        {
            return new List<Problem>();
        }

        [HttpPost]
        public Guid Add(Problem problem)
        {
            using (var db = new LiteDatabase(DatabaseFilename))
            {
                var problems = db.GetCollection<Problem>();
                problem.Id = Guid.NewGuid();
                problems.Insert(problem);
                return problem.Id;
            }
        }

        [HttpGet]
        [Route("{id}")]
        public Problem Get(Guid id)
        {
            using (var db = new LiteDatabase(DatabaseFilename))
            {
                var problems = db.GetCollection<Problem>();
                var all = problems.Query().ToList();
                return problems.Query().Where(x => x.Id == id).FirstOrDefault();
            }
        }

        [HttpPut]
        public void Update(Problem problem)
        {
            using (var db = new LiteDatabase(DatabaseFilename))
            {
                var problems = db.GetCollection<Problem>();
                var existingProblem =  problems.Query().Where(x => x.Id == problem.Id).FirstOrDefault();
                existingProblem.Difficulty = problem.Difficulty;
                existingProblem.Name = problem.Name;
                existingProblem.Route = problem.Route;
                existingProblem.Setter = problem.Setter;
                problems.Update(existingProblem);
            }
        }

        [HttpDelete]
        [Route("{id}")]
        public void Delete(Guid id)
        {
            using (var db = new LiteDatabase(DatabaseFilename))
            {
                var problems = db.GetCollection<Problem>();
                problems.Delete(id);
            }
        }

        [HttpGet]
        [Route("search")]
        public List<Problem> Get([FromQuery]string name, [FromQuery]string min, [FromQuery]string max, [FromQuery]string setter)
        {
            using (var db = new LiteDatabase(DatabaseFilename))
            {
                var problems = db.GetCollection<Problem>();

                var query = problems.Query();

                if (!string.IsNullOrEmpty(name))
                    query = query.Where(x => x.Name.Contains(name));

                var difficulties = new List<string>();
                var minInt = string.IsNullOrEmpty(min) ? 0 : Int32.Parse(min.Replace("V", ""));
                var maxInt = string.IsNullOrEmpty(max) ? 10 : Int32.Parse(max.Replace("V", ""));

                for (var i = minInt; i <= maxInt; i++)
                    difficulties.Add("V" + i);
                query = query.Where(x => difficulties.Contains(x.Difficulty));

                if (!string.IsNullOrEmpty(setter))
                    query = query.Where(x => x.Setter.Contains(setter));

                return query.OrderBy(x => x.Name).ToList();
            }
        }
    }
}
