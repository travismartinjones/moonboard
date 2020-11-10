using System.Collections.Generic;

namespace frontend.ViewModels
{
    public class RgbIndex
    {
        public string Index { get; set; }
        public int R { get; set; }
        public int G { get; set; }
        public int B { get; set; }
    }

    public class Route
    {
        public List<string> START { get; set; }
        public List<string> MOVES { get; set; }
        public List<string> FEET { get; set; }
        public List<string> TOP { get; set; }
        public List<RgbIndex> RGB { get; set; }
    }
}
