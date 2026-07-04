import { Hexagon } from 'lucide-react'; // Assuming you are using Lucide

const Header = () => {
    return (
        <header>
            <div className="login__logo">
                <div className="login__logo-icon">
                    <Hexagon size={22} />
                </div>
                <span className="login__wordmark">daleelex</span>
            </div>
        </header>
    );
};

export default Header;