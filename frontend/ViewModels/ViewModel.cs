using System;
using LiteDB;

namespace frontend.ViewModels
{
    public abstract class ViewModel
    {
        [BsonId]
        public Guid Id { get; set; }
    }
}
