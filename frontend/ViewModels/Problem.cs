namespace frontend.ViewModels
{
    public class Problem : ViewModel
    {
        public string Name { get; set; }
        public string Difficulty { get; set; }
        public string Setter { get; set; }
        public string Notes { get; set; }
        public Route Route { get; set; }
        public string Setup { get; set; }
    }
}
